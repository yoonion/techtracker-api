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

@Injectable()
export class BlogPostService {
  constructor(
    @InjectRepository(BlogPost)
    private readonly blogPostRepository: Repository<BlogPost>,
  ) {}

  async upsertManyFromFeed(source: BlogSource, items: CollectedFeedItem[]) {
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

      await this.blogPostRepository.save(created);
    }
  }

  async getPublicFeed(limit = 50) {
    const safeLimit = Math.max(1, Math.min(limit, 200));

    const posts = await this.blogPostRepository.find({
      relations: ['source'],
      order: {
        publishedAt: 'DESC',
        collectedAt: 'DESC',
      },
      take: safeLimit,
    });

    return posts.map((post) => ({
      id: post.id,
      title: post.title,
      summary: post.summary,
      url: post.url,
      publishedAt: post.publishedAt,
      collectedAt: post.collectedAt,
      source: {
        id: post.source.id,
        url: post.source.url,
      },
    }));
  }
}
