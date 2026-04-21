import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlogSourceService } from '../blog-source/blog-source.service';
import { BlogSource } from '../blog-source/blog-source.entity';
import { BlogPostService, CollectedFeedItem } from '../blog-post/blog-post.service';

@Injectable()
export class FeedCollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeedCollectorService.name);
  private readonly defaultHeaders: Record<string, string> = {
    'User-Agent':
      'TechTrackerBot/1.0 (+https://techtracker.local; feed collector)',
    Accept:
      'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
  };
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly intervalMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly blogSourceService: BlogSourceService,
    private readonly blogPostService: BlogPostService,
  ) {
    this.intervalMs = this.configService.get<number>(
      'COLLECTOR_INTERVAL_MS',
      5 * 60 * 1000,
    );
  }

  onModuleInit() {
    if (this.intervalMs <= 0) {
      this.logger.warn(
        `Collector disabled because interval is invalid: ${this.intervalMs}`,
      );
      return;
    }

    this.timer = setInterval(() => {
      void this.runCollectionCycle();
    }, this.intervalMs);

    this.logger.log(
      `Feed collector started (interval: ${this.intervalMs}ms, ${Math.floor(
        this.intervalMs / 1000,
      )}s)`,
    );

    void this.runCollectionCycle();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCollectionCycle() {
    if (this.isRunning) {
      this.logger.warn('Collection cycle is already running. Skipping.');
      return;
    }

    this.isRunning = true;
    try {
      const sources = await this.blogSourceService.getActiveBlogSources();

      if (sources.length === 0) {
        this.logger.debug('No active blog sources to collect.');
        return;
      }

      this.logger.log(`Collection cycle started for ${sources.length} sources.`);
      for (const source of sources) {
        await this.collectSource(source);
      }
      this.logger.log('Collection cycle finished.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Collection cycle failed: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async collectSource(source: BlogSource) {
    try {
      const storedFeedUrl = source.rssUrl?.trim() || null;
      let discoveredFeedUrl: string | null = storedFeedUrl;
      let feedXml: string | null = null;

      if (storedFeedUrl) {
        feedXml = await this.fetchFeedXml(storedFeedUrl);
        if (!feedXml) {
          discoveredFeedUrl = null;
        }
      }

      if (!discoveredFeedUrl) {
        discoveredFeedUrl = await this.discoverFeedUrl(source.url);
      }

      if (discoveredFeedUrl) {
        this.logger.log(
          `Feed found for source ${source.id}: ${discoveredFeedUrl}`,
        );

        if (!feedXml) {
          feedXml = await this.fetchFeedXml(discoveredFeedUrl);
        }
        if (feedXml) {
          const items = this.parseFeedItems(feedXml, discoveredFeedUrl);
          if (items.length > 0) {
            await this.blogPostService.upsertManyFromFeed(source, items);
            this.logger.log(
              `Saved ${items.length} posts for source ${source.id}`,
            );
          } else {
            this.logger.warn(
              `No parsable posts found in feed: ${discoveredFeedUrl}`,
            );
          }
        }
      } else {
        this.logger.warn(`No feed found for source ${source.id}: ${source.url}`);
      }

      const discoveredIconUrl = await this.discoverIconUrl(
        source.url,
        discoveredFeedUrl,
        feedXml,
      );

      await this.blogSourceService.updateCollectionMetadata(
        source.id,
        new Date(),
        discoveredFeedUrl,
        discoveredIconUrl,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to collect source ${source.id} (${source.url}): ${message}`,
      );
    }
  }

  private async discoverFeedUrl(sourceUrl: string): Promise<string | null> {
    const candidates = this.buildFeedCandidates(sourceUrl);

    for (const candidate of candidates) {
      const feedUrl = await this.resolveFeedUrl(candidate, new Set<string>());
      if (feedUrl) {
        return feedUrl;
      }
    }

    return null;
  }

  private buildFeedCandidates(sourceUrl: string): string[] {
    const candidates = new Set<string>();
    candidates.add(sourceUrl);

    const commonPaths = ['/feed', '/rss', '/atom.xml', '/rss.xml', '/feed.xml'];
    for (const path of commonPaths) {
      candidates.add(new URL(path, sourceUrl).toString());
    }

    return [...candidates];
  }

  private async resolveFeedUrl(
    url: string,
    visited: Set<string>,
  ): Promise<string | null> {
    if (visited.has(url)) {
      return null;
    }
    visited.add(url);

    try {
      const response = await this.fetchWithRetry(url, 8000);

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (
        contentType.includes('application/rss+xml') ||
        contentType.includes('application/atom+xml') ||
        contentType.includes('application/xml') ||
        contentType.includes('text/xml')
      ) {
        return url;
      }

      if (!contentType.includes('text/html')) {
        const body = (await response.text()).slice(0, 5000).toLowerCase();
        const looksLikeFeed =
          body.includes('<rss') ||
          body.includes('<feed') ||
          body.includes('<rdf:rdf');
        return looksLikeFeed ? url : null;
      }

      const html = await response.text();
      const feedLinks = this.extractFeedLinksFromHtml(html, url);

      for (const link of feedLinks) {
        const resolved = await this.resolveFeedUrl(link, visited);
        if (resolved) {
          return resolved;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private extractFeedLinksFromHtml(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkTagRegex = /<link\s+[^>]*>/gi;
    const tags = html.match(linkTagRegex) ?? [];

    for (const tag of tags) {
      const relMatch = tag.match(/rel=["']([^"']+)["']/i);
      const typeMatch = tag.match(/type=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);

      if (!hrefMatch) {
        continue;
      }

      const relValue = relMatch?.[1]?.toLowerCase() ?? '';
      const typeValue = typeMatch?.[1]?.toLowerCase() ?? '';

      const isAlternate = relValue.includes('alternate');
      const isFeedType =
        typeValue.includes('application/rss+xml') ||
        typeValue.includes('application/atom+xml') ||
        typeValue.includes('application/xml') ||
        typeValue.includes('text/xml');

      if (!isAlternate || !isFeedType) {
        continue;
      }

      try {
        links.push(new URL(this.cleanText(hrefMatch[1]), baseUrl).toString());
      } catch {
        continue;
      }
    }

    return links;
  }

  private async discoverIconUrl(
    sourceUrl: string,
    feedUrl: string | null,
    feedXml: string | null,
  ): Promise<string | null> {
    const sourceHost = this.safeGetHost(sourceUrl);
    const isMediumSource = sourceHost === 'medium.com';
    const feedImageUrls =
      feedXml && feedUrl
        ? this.extractFeedImageUrls(feedXml, feedUrl)
        : feedXml
          ? this.extractFeedImageUrls(feedXml, sourceUrl)
          : [];

    // Medium 계열은 도메인 favicon이 공용이라, feed 채널 이미지를 우선 시도.
    if (isMediumSource) {
      for (const imageUrl of feedImageUrls) {
        if (await this.isReachableUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }

    try {
      const response = await this.fetchWithRetry(sourceUrl, 8000);

      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('text/html')) {
          const html = await response.text();
          const iconLinks = this.extractIconLinksFromHtml(html, sourceUrl);
          for (const iconUrl of iconLinks) {
            if (await this.isReachableUrl(iconUrl)) {
              return iconUrl;
            }
          }
        }
      }
    } catch {
      // ignore and fallback
    }

    // 일반 사이트는 favicon/rel icon 우선. 그래도 없을 때 feed 채널 이미지 fallback.
    if (!isMediumSource) {
      try {
        const faviconUrl = new URL('/favicon.ico', sourceUrl).toString();
        if (await this.isReachableUrl(faviconUrl)) {
          return faviconUrl;
        }
      } catch {
        // ignore
      }

      for (const imageUrl of feedImageUrls) {
        if (await this.isReachableUrl(imageUrl)) {
          return imageUrl;
        }
      }
    }

    try {
      const fallback = new URL('/favicon.ico', sourceUrl).toString();
      if (await this.isReachableUrl(fallback)) {
        return fallback;
      }
    } catch {
      return null;
    }

    return null;
  }

  private extractFeedImageUrls(feedXml: string, baseUrl: string): string[] {
    const links = new Set<string>();

    const rssImageUrlMatch = feedXml.match(
      /<image\b[\s\S]*?<url[^>]*>([\s\S]*?)<\/url>[\s\S]*?<\/image>/i,
    );
    if (rssImageUrlMatch?.[1]) {
      links.add(this.toAbsoluteUrl(this.cleanText(rssImageUrlMatch[1]), baseUrl));
    }

    const itunesImageRegex = /<itunes:image\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let itunesMatch: RegExpExecArray | null = itunesImageRegex.exec(feedXml);
    while (itunesMatch?.[1]) {
      links.add(this.toAbsoluteUrl(this.cleanText(itunesMatch[1]), baseUrl));
      itunesMatch = itunesImageRegex.exec(feedXml);
    }

    const atomIcon = this.readTag(feedXml, 'icon');
    if (atomIcon) {
      links.add(this.toAbsoluteUrl(atomIcon, baseUrl));
    }

    const atomLogo = this.readTag(feedXml, 'logo');
    if (atomLogo) {
      links.add(this.toAbsoluteUrl(atomLogo, baseUrl));
    }

    return [...links].filter(Boolean);
  }

  private extractIconLinksFromHtml(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkTagRegex = /<link\s+[^>]*>/gi;
    const tags = html.match(linkTagRegex) ?? [];

    for (const tag of tags) {
      const relMatch = tag.match(/rel=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);

      if (!relMatch || !hrefMatch) {
        continue;
      }

      const rel = relMatch[1].toLowerCase();
      const isIconRel =
        rel.includes('icon') ||
        rel.includes('apple-touch-icon') ||
        rel.includes('shortcut icon');

      if (!isIconRel) {
        continue;
      }

      try {
        links.push(new URL(this.cleanText(hrefMatch[1]), baseUrl).toString());
      } catch {
        continue;
      }
    }

    return links;
  }

  private async isReachableUrl(url: string): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(url, 8000);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async fetchFeedXml(feedUrl: string): Promise<string | null> {
    try {
      const response = await this.fetchWithRetry(feedUrl, 10000);

      if (!response.ok) {
        return null;
      }

      const content = await response.text();
      const lower = content.toLowerCase();
      if (
        lower.includes('<rss') ||
        lower.includes('<feed') ||
        lower.includes('<rdf:rdf')
      ) {
        return content;
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseFeedItems(
    feedXml: string,
    baseUrl: string,
  ): CollectedFeedItem[] {
    const xml = feedXml.trim();
    const lowerXml = xml.toLowerCase();
    if (lowerXml.includes('<item')) {
      return this.parseRssItems(xml, baseUrl);
    }
    if (lowerXml.includes('<entry')) {
      return this.parseAtomEntries(xml, baseUrl);
    }
    return [];
  }

  private parseRssItems(feedXml: string, baseUrl: string): CollectedFeedItem[] {
    const blocks = feedXml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    const items: CollectedFeedItem[] = [];

    for (const block of blocks) {
      const title = this.readTag(block, 'title');
      const link = this.readTag(block, 'link') ?? this.readRssLinkFromTag(block);
      const guid = this.readTag(block, 'guid');
      const summary =
        this.readTag(block, 'description') ??
        this.readTag(block, 'content:encoded');
      const publishedRaw =
        this.readTag(block, 'pubDate') ?? this.readTag(block, 'dc:date');

      const resolvedUrl = link ?? guid;
      if (!title || !resolvedUrl) {
        continue;
      }
      const absoluteUrl = this.toAbsoluteUrl(resolvedUrl, baseUrl);

      items.push({
        externalId: guid ?? absoluteUrl,
        url: absoluteUrl,
        title: this.cleanText(title),
        summary: summary ? this.cleanText(summary) : null,
        publishedAt: this.parseDate(publishedRaw),
      });
    }

    return items;
  }

  private parseAtomEntries(
    feedXml: string,
    baseUrl: string,
  ): CollectedFeedItem[] {
    const blocks = feedXml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
    const items: CollectedFeedItem[] = [];

    for (const block of blocks) {
      const title = this.readTag(block, 'title');
      const id = this.readTag(block, 'id');
      const url = this.readAtomLink(block);
      const summary = this.readTag(block, 'summary') ?? this.readTag(block, 'content');
      const publishedRaw =
        this.readTag(block, 'published') ?? this.readTag(block, 'updated');

      const resolvedUrl = url ?? id;
      if (!title || !resolvedUrl) {
        continue;
      }
      const absoluteUrl = this.toAbsoluteUrl(resolvedUrl, baseUrl);

      items.push({
        externalId: id ?? absoluteUrl,
        url: absoluteUrl,
        title: this.cleanText(title),
        summary: summary ? this.cleanText(summary) : null,
        publishedAt: this.parseDate(publishedRaw),
      });
    }

    return items;
  }

  private readTag(xml: string, tagName: string): string | null {
    const escaped = tagName.replace(':', '\\:');
    const hasPrefix = tagName.includes(':');
    const namePattern = hasPrefix ? escaped : `(?:[\\w-]+:)?${escaped}`;
    const regex = new RegExp(
      `<${namePattern}[^>]*>([\\s\\S]*?)<\\/${namePattern}>`,
      'i',
    );
    const match = xml.match(regex);
    if (!match) {
      return null;
    }
    return this.cleanText(match[1]);
  }

  private readAtomLink(entryXml: string): string | null {
    const linkTags = entryXml.match(/<link\b[^>]*>/gi) ?? [];
    const candidateByRel = new Map<string, string>();

    for (const tag of linkTags) {
      const relMatch = tag.match(/rel=["']([^"']+)["']/i);
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) {
        continue;
      }
      const rel = relMatch?.[1]?.toLowerCase() ?? 'alternate';
      if (rel === 'alternate' || rel === 'self' || rel === 'related') {
        candidateByRel.set(rel, hrefMatch[1]);
      }
    }

    return (
      candidateByRel.get('alternate') ??
      candidateByRel.get('related') ??
      candidateByRel.get('self') ??
      null
    );
  }

  private readRssLinkFromTag(itemXml: string): string | null {
    const linkTags = itemXml.match(/<link\b[^>]*>/gi) ?? [];
    for (const tag of linkTags) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        return hrefMatch[1];
      }
    }
    return null;
  }

  private toAbsoluteUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  private safeGetHost(url: string): string | null {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private async fetchWithRetry(
    url: string,
    timeoutMs: number,
    maxAttempts = 2,
  ): Promise<Response> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: this.defaultHeaders,
          redirect: 'follow',
        });
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) {
          break;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('fetch failed');
  }

  private cleanText(value: string): string {
    return value
      .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseDate(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }
}
