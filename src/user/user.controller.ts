import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UserController {
  constructor(private userServices: UserService) {}

  @Get()
  getUsers() {
    return this.userServices.getUsers();
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.userServices.getUser(Number(id));
  }

  @Post()
  createUser(@Body() body: CreateUserDto) {
    return this.userServices.createUser(body);
  }
}
