import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

loadEnv({ path: process.env.ENV_FILE ?? '.env' });

const isTsRuntime =
  (process.env.TS_NODE ?? '').toLowerCase() === 'true' ||
  __filename.endsWith('.ts');

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: process.env.DB_TIMEZONE ?? 'Z',
  namingStrategy: new SnakeNamingStrategy(),
  entities: [isTsRuntime ? 'src/**/*.entity.ts' : 'dist/**/*.entity.js'],
  migrations: [
    isTsRuntime
      ? 'src/database/migrations/*.ts'
      : 'dist/database/migrations/*.js',
  ],
});
