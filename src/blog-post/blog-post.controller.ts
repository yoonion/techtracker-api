import { Controller, Get, Query } from '@nestjs/common';
import { BlogPostService } from './blog-post.service';

@Controller('blog-posts')
export class BlogPostController {
  constructor(private readonly blogPostService: BlogPostService) {}

  @Get('public')
  getPublicFeed(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 50;
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 50;
    return this.blogPostService.getPublicFeed(safeLimit);
  }
}
