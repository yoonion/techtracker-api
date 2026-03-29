import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  updateUser(id: number, updateData: UpdateUserDto) {
    const user = this.users[id];

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.users[id] = {
      ...user,
      ...updateData
    };

    return this.users[id];
  }
}