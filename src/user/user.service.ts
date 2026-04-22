import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from './user-role.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  getUsers() {
    return this.userRepository.find({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  async createUser(dto: CreateUserDto) {
    const existingUser = await this.getUserByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('이미 가입된 회원입니다.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      role: UserRole.USER,
    });

    return this.userRepository.save(user);
  }

  async getUser(id: number) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(id: number, updateData: UpdateUserDto) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, updateData);

    return this.userRepository.save(user);
  }

  async deleteUser(id: number) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.remove(user);

    return { message: 'deleted' };
  }

  getUserByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async updateRefreshToken(userId: number, token: string) {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.refreshToken = token;

    await this.userRepository.save(user);
  }

  async linkDiscordAccount(
    userId: number,
    discordUserId: string,
    discordUsername: string,
  ) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingLinkedUser = await this.userRepository.findOne({
      where: { discordUserId },
      select: { id: true },
    });

    if (existingLinkedUser && existingLinkedUser.id !== userId) {
      throw new ConflictException('이미 다른 계정에 연결된 Discord 계정입니다.');
    }

    user.discordUserId = discordUserId;
    user.discordUsername = discordUsername;
    user.discordConnectedAt = new Date();

    await this.userRepository.save(user);
  }

  async getDiscordConnection(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        discordUserId: true,
        discordUsername: true,
        discordConnectedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      connected: Boolean(user.discordUserId),
      discordUsername: user.discordUsername,
      discordConnectedAt: user.discordConnectedAt,
    };
  }
}
