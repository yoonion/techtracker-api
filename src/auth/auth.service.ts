import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { UserService } from '../user/user.service';
import { ConfigService } from '@nestjs/config';

type DiscordStatePayload = {
  sub: number;
  provider: 'discord';
};

type DiscordTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type DiscordUserResponse = {
  id?: string;
  username?: string;
  global_name?: string | null;
  discriminator?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userService.getUserByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('User Not Found');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid credentials. Passwords do not match',
      );
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // refresh token 저장
    await this.userService.updateRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      name: user.name,
      role: user.role,
    };
  }

  async refresh(refreshToken: string) {
    const payload = this.jwtService.verify(refreshToken);

    const user = await this.userService.getUser(payload.sub);

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const newAccessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '1h' },
    );

    return {
      accessToken: newAccessToken,
    };
  }

  getDiscordConnectUrl(userId: number) {
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const redirectUri = this.configService.get<string>('DISCORD_REDIRECT_URI');
    const stateSecret =
      this.configService.get<string>('DISCORD_STATE_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    if (!clientId || !redirectUri || !stateSecret) {
      throw new InternalServerErrorException(
        'Discord OAuth 환경변수가 설정되지 않았습니다.',
      );
    }

    const state = this.jwtService.sign(
      { sub: userId, provider: 'discord' },
      {
        secret: stateSecret,
        expiresIn: '10m',
      },
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      prompt: 'consent',
      state,
    });

    return {
      url: `https://discord.com/oauth2/authorize?${params.toString()}`,
    };
  }

  async completeDiscordOAuth(code: string, state: string) {
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('DISCORD_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('DISCORD_REDIRECT_URI');
    const stateSecret =
      this.configService.get<string>('DISCORD_STATE_SECRET') ??
      this.configService.get<string>('JWT_SECRET');

    if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
      throw new InternalServerErrorException(
        'Discord OAuth 환경변수가 설정되지 않았습니다.',
      );
    }

    let payload: DiscordStatePayload;
    try {
      payload = this.jwtService.verify<DiscordStatePayload>(state, {
        secret: stateSecret,
      });
    } catch {
      throw new BadRequestException('유효하지 않은 Discord 연동 요청입니다.');
    }

    if (!payload?.sub || payload.provider !== 'discord') {
      throw new BadRequestException('유효하지 않은 Discord state 입니다.');
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const tokenResult = (await tokenResponse.json()) as DiscordTokenResponse;
    if (!tokenResponse.ok || !tokenResult.access_token) {
      throw new BadRequestException(
        tokenResult.error_description ?? 'Discord 토큰 발급에 실패했습니다.',
      );
    }

    const meResponse = await fetch('https://discord.com/api/users/@me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenResult.access_token}`,
      },
    });

    const me = (await meResponse.json()) as DiscordUserResponse;
    if (!meResponse.ok || !me.id || !me.username) {
      throw new BadRequestException('Discord 사용자 정보 조회에 실패했습니다.');
    }

    const discordUsername = me.global_name?.trim()
      ? me.global_name.trim()
      : me.discriminator && me.discriminator !== '0'
        ? `${me.username}#${me.discriminator}`
        : me.username;

    await this.userService.linkDiscordAccount(
      payload.sub,
      me.id,
      discordUsername,
    );
  }

  getDiscordStatus(userId: number) {
    return this.userService.getDiscordConnection(userId);
  }

  getDiscordRedirectUrl(success: boolean, message?: string) {
    const frontendBaseUrl = this.configService.get<string>(
      'FRONTEND_BASE_URL',
      'http://localhost:3000',
    );
    const redirectUrl = new URL('/', frontendBaseUrl);
    redirectUrl.searchParams.set('discord', success ? 'connected' : 'error');
    if (message) {
      redirectUrl.searchParams.set('message', message);
    }
    return redirectUrl.toString();
  }
}
