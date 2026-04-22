import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlogSource } from '../blog-source/blog-source.entity';
import { NewCollectedPost } from '../blog-post/blog-post.service';
import { BlogSubscriptionService } from '../blog-subscription/blog-subscription.service';

@Injectable()
export class DiscordNotificationService {
  private readonly logger = new Logger(DiscordNotificationService.name);
  private readonly botToken: string | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly blogSubscriptionService: BlogSubscriptionService,
  ) {
    this.botToken = this.configService.get<string>('DISCORD_BOT_TOKEN') ?? null;
  }

  async notifyNewPosts(source: BlogSource, newPosts: NewCollectedPost[]) {
    if (!this.botToken || !newPosts.length) {
      return;
    }

    const subscribers =
      await this.blogSubscriptionService.getDiscordSubscribersBySourceId(source.id);
    if (!subscribers.length) {
      return;
    }

    for (const subscriber of subscribers) {
      try {
        const channelId = await this.ensureDmChannel(subscriber.discordUserId);
        if (!channelId) {
          continue;
        }

        for (const post of newPosts.slice(0, 5)) {
          const message = this.buildMessage(source, post);
          await this.sendMessage(channelId, message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Discord DM failed for user ${subscriber.userId} (${subscriber.discordUserId}): ${message}`,
        );
      }
    }
  }

  private buildMessage(source: BlogSource, post: NewCollectedPost): string {
    const publishedText = post.publishedAt
      ? this.toKstString(post.publishedAt)
      : '발행일 미확인';

    return [
      'TechTracker 새 글 알림',
      `블로그: ${source.name ?? source.url}`,
      `제목: ${post.title}`,
      `발행일: ${publishedText}`,
      `링크: ${post.url}`,
    ].join('\n');
  }

  private toKstString(date: Date): string {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private async ensureDmChannel(discordUserId: string): Promise<string | null> {
    const response = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: this.getJsonHeaders(),
      body: JSON.stringify({ recipient_id: discordUserId }),
    });

    const result = (await response.json()) as { id?: string; message?: string };
    if (!response.ok || !result.id) {
      const reason = result.message ?? 'DM channel open failed';
      this.logger.warn(
        `Could not open DM channel for ${discordUserId}: ${reason}`,
      );
      return null;
    }

    return result.id;
  }

  private async sendMessage(channelId: string, content: string) {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: this.getJsonHeaders(),
        body: JSON.stringify({ content }),
      },
    );

    if (!response.ok) {
      const result = (await response.json()) as { message?: string };
      const reason = result.message ?? `HTTP ${response.status}`;
      throw new Error(`message send failed: ${reason}`);
    }
  }

  private getJsonHeaders() {
    return {
      Authorization: `Bot ${this.botToken}`,
      'Content-Type': 'application/json',
    };
  }
}
