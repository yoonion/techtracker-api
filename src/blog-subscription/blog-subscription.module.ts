import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogSubscription } from './blog-subscription.entity';
import { BlogSubscriptionController } from './blog-subscription.controller';
import { BlogSubscriptionService } from './blog-subscription.service';
import { BlogSource } from '../blog-source/blog-source.entity';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlogSubscription, BlogSource, User])],
  controllers: [BlogSubscriptionController],
  providers: [BlogSubscriptionService],
  exports: [BlogSubscriptionService],
})
export class BlogSubscriptionModule {}

