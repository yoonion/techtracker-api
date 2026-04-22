import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPost } from './blog-post.entity';
import { BlogSource } from '../blog-source/blog-source.entity';

export type CollectedFeedItem = {
  externalId: string;
  url: string;
  title: string;
  summary: string | null;
  publishedAt: Date | null;
};

export type NewCollectedPost = {
  id: number;
  title: string;
  url: string;
  publishedAt: Date | null;
};

@Injectable()
export class BlogPostService {
  constructor(
    @InjectRepository(BlogPost)
    private readonly blogPostRepository: Repository<BlogPost>,
  ) {}

  async upsertManyFromFeed(
    source: BlogSource,
    items: CollectedFeedItem[],
  ): Promise<NewCollectedPost[]> {
    const newPosts: NewCollectedPost[] = [];

    for (const item of items) {
      const externalId = item.externalId.trim();
      const url = item.url.trim();
      const title = item.title.trim();

      if (!externalId || !url || !title) {
        continue;
      }

      const existing = await this.blogPostRepository.findOne({
        where: {
          source: { id: source.id },
          externalId,
        },
        relations: ['source'],
      });

      if (existing) {
        existing.url = url;
        existing.title = title;
        existing.summary = item.summary;
        existing.publishedAt = item.publishedAt;
        existing.collectedAt = new Date();
        await this.blogPostRepository.save(existing);
        continue;
      }

      const created = this.blogPostRepository.create({
        source: { id: source.id },
        externalId,
        url,
        title,
        summary: item.summary,
        publishedAt: item.publishedAt,
        collectedAt: new Date(),
      });

      const saved = await this.blogPostRepository.save(created);
      newPosts.push({
        id: saved.id,
        title: saved.title,
        url: saved.url,
        publishedAt: saved.publishedAt,
      });
    }

    return newPosts;
  }

  async getPublicFeed(page = 1, limit = 20, sourceId?: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const where = sourceId ? { source: { id: sourceId } } : {};

    const [posts, total] = await this.blogPostRepository.findAndCount({
      where,
      relations: ['source'],
      order: {
        publishedAt: 'DESC',
        collectedAt: 'DESC',
      },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      items: posts.map((post) => ({
        id: post.id,
        title: post.title,
        summary: post.summary,
        url: post.url,
        publishedAt: post.publishedAt,
        collectedAt: post.collectedAt,
        source: {
          id: post.source.id,
          name: post.source.name,
          url: post.source.url,
          iconUrl: post.source.iconUrl,
        },
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }
}
