import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BlogSubscription } from './blog-subscription.entity';
import { Repository } from 'typeorm';
import { BlogSource } from '../blog-source/blog-source.entity';
import { User } from '../user/user.entity';

@Injectable()
export class BlogSubscriptionService {
  constructor(
    @InjectRepository(BlogSubscription)
    private readonly blogSubscriptionRepository: Repository<BlogSubscription>,
    @InjectRepository(BlogSource)
    private readonly blogSourceRepository: Repository<BlogSource>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getMySubscriptions(userId: number) {
    const subscriptions = await this.blogSubscriptionRepository.find({
      where: { user: { id: userId } },
      relations: ['source'],
    });

    const sourceIds = subscriptions.map((subscription) => subscription.source.id);
    return { sourceIds };
  }

  async subscribe(userId: number, sourceId: number) {
    const [user, source, existing] = await Promise.all([
      this.userRepository.findOneBy({ id: userId }),
      this.blogSourceRepository.findOneBy({ id: sourceId }),
      this.blogSubscriptionRepository.findOne({
        where: { user: { id: userId }, source: { id: sourceId } },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!source) {
      throw new NotFoundException('Blog source not found');
    }

    if (existing) {
      return { subscribed: true, sourceId };
    }

    const created = this.blogSubscriptionRepository.create({
      user,
      source,
    });
    await this.blogSubscriptionRepository.save(created);

    return { subscribed: true, sourceId };
  }

  async unsubscribe(userId: number, sourceId: number) {
    const source = await this.blogSourceRepository.findOneBy({ id: sourceId });
    if (!source) {
      throw new NotFoundException('Blog source not found');
    }

    await this.blogSubscriptionRepository.delete({
      user: { id: userId },
      source: { id: sourceId },
    });

    return { subscribed: false, sourceId };
  }

  async getDiscordSubscribersBySourceId(sourceId: number) {
    const rows = await this.blogSubscriptionRepository
      .createQueryBuilder('subscription')
      .innerJoin('subscription.source', 'source')
      .innerJoin('subscription.user', 'user')
      .select('user.id', 'userId')
      .addSelect('user.discordUserId', 'discordUserId')
      .addSelect('user.discordUsername', 'discordUsername')
      .where('source.id = :sourceId', { sourceId })
      .andWhere('user.discordUserId IS NOT NULL')
      .getRawMany<{
        userId: string;
        discordUserId: string | null;
        discordUsername: string | null;
      }>();

    return rows
      .filter((row) => typeof row.discordUserId === 'string' && row.discordUserId)
      .map((row) => ({
        userId: Number(row.userId),
        discordUserId: row.discordUserId as string,
        discordUsername: row.discordUsername,
      }));
  }
}
