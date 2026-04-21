import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { BlogSubscriptionService } from './blog-subscription.service';
import { CurrentUser } from '../auth/current-user.decorator';

type AuthUser = {
  userId: number;
  email: string;
  role: string;
};

@Controller('blog-subscriptions')
@UseGuards(JwtAuthGuard)
export class BlogSubscriptionController {
  constructor(
    private readonly blogSubscriptionService: BlogSubscriptionService,
  ) {}

  @Get('me')
  getMySubscriptions(@CurrentUser() user: AuthUser) {
    return this.blogSubscriptionService.getMySubscriptions(user.userId);
  }

  @Post(':sourceId')
  subscribe(
    @CurrentUser() user: AuthUser,
    @Param('sourceId', ParseIntPipe) sourceId: number,
  ) {
    return this.blogSubscriptionService.subscribe(user.userId, sourceId);
  }

  @Delete(':sourceId')
  unsubscribe(
    @CurrentUser() user: AuthUser,
    @Param('sourceId', ParseIntPipe) sourceId: number,
  ) {
    return this.blogSubscriptionService.unsubscribe(user.userId, sourceId);
  }
}

