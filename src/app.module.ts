import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostModule } from './post/post.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BlogSourceModule } from './blog-source/blog-source.module';
import { CollectorModule } from './collector/collector.module';
import { BlogPostModule } from './blog-post/blog-post.module';
import { BlogSubscriptionModule } from './blog-subscription/blog-subscription.module';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'nestdb'),
        timezone: configService.get<string>('DB_TIMEZONE', 'Z'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('DB_SYNC', 'false') === 'true',
        namingStrategy: new SnakeNamingStrategy(),
      }),
    }),
    UserModule,
    PostModule,
    AuthModule,
    BlogSourceModule,
    BlogPostModule,
    BlogSubscriptionModule,
    CollectorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
