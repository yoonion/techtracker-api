import { Module } from '@nestjs/common';
import { BlogSourceModule } from '../blog-source/blog-source.module';
import { FeedCollectorService } from './feed-collector.service';
import { BlogPostModule } from '../blog-post/blog-post.module';
import { BlogSubscriptionModule } from '../blog-subscription/blog-subscription.module';
import { DiscordNotificationService } from './discord-notification.service';

@Module({
  imports: [BlogSourceModule, BlogPostModule, BlogSubscriptionModule],
  providers: [FeedCollectorService, DiscordNotificationService],
})
export class CollectorModule {}
