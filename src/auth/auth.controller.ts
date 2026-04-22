import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt/jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { Response } from 'express';

type AuthUser = {
  userId: number;
  email: string;
  role: string;
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Get('discord/connect')
  @UseGuards(JwtAuthGuard)
  getDiscordConnectUrl(@CurrentUser() user: AuthUser) {
    return this.authService.getDiscordConnectUrl(user.userId);
  }

  @Get('discord/status')
  @UseGuards(JwtAuthGuard)
  getDiscordStatus(@CurrentUser() user: AuthUser) {
    return this.authService.getDiscordStatus(user.userId);
  }

  @Get('discord/callback')
  async discordCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    if (!code || !state) {
      const redirectUrl = this.authService.getDiscordRedirectUrl(
        false,
        '인증 파라미터가 누락되었습니다.',
      );
      return response.redirect(redirectUrl);
    }

    try {
      await this.authService.completeDiscordOAuth(code, state);
      return response.redirect(this.authService.getDiscordRedirectUrl(true));
    } catch (error) {
      const message =
        error instanceof BadRequestException
          ? (error.getResponse() as { message?: string }).message ??
            'Discord 연동에 실패했습니다.'
          : 'Discord 연동 중 오류가 발생했습니다.';
      return response.redirect(
        this.authService.getDiscordRedirectUrl(false, message),
      );
    }
  }
}
