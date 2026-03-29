import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  getUsers() {
    return [
      { id: 1, name: 'kim' },
      { id: 2, name: 'lee' },
    ];
  }
}