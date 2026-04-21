import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
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

    const payload = { sub: user.id, email: user.email };

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
    };
  }

  async refresh(refreshToken: string) {
    const payload = this.jwtService.verify(refreshToken);

    const user = await this.userService.getUser(payload.sub);

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const newAccessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '1h' },
    );

    return {
      accessToken: newAccessToken,
    };
  }
}
