import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  private users: CreateUserDto[] = [];

  getUsers() {
    return this.users;
  }

  createUser(user) {
    this.users.push(user);
    return this.users;
  }

  getUser(id: number) {
    const user = this.users.find((_, index) => index === id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}