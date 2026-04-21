import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BlogSourceService } from './blog-source.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../user/user-role.enum';
import { CreateBlogSourceDto } from './dto/create-blog-source.dto';
import { ToggleBlogSourceDto } from './dto/toggle-blog-source.dto';

@Controller('blog-sources')
export class BlogSourceController {
  constructor(private readonly blogSourceService: BlogSourceService) {}

  @Get('public')
  getPublicBlogSources() {
    return this.blogSourceService.getBlogSources();
  }

  @Get('active')
  getActiveBlogSources() {
    return this.blogSourceService.getActiveBlogSources();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getBlogSources() {
    return this.blogSourceService.getBlogSources();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createBlogSource(@Body() dto: CreateBlogSourceDto) {
    return this.blogSourceService.createBlogSource(dto);
  }

  @Patch(':id/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateActiveStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleBlogSourceDto,
  ) {
    return this.blogSourceService.updateActiveStatus(id, dto.isActive);
  }
}
