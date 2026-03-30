import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  login(user: any) {
    const payload = { sub: user.id, username: user.username };

    return {
      accessToken: this.jwtService.sign(payload),
    }
  }
}
