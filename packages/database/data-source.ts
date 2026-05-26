import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

// Load the env file matching DEPLOY_ENV (.env.prod / .env.dev / .env.local)
// from the current working directory. Must run before AppDataSource is constructed
// because process.env.DB_* is read inline below.
dotenv.config({ path: resolveEnvFilePath() });

// Standalone DataSource for TypeORM CLI (migration:generate, migration:run, etc.)
// Not used by NestJS DI — AppModule uses TypeOrmModule.forRootAsync instead.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_DATABASE ?? 'marketplace',
  synchronize: false,
  logging: true,
  entities: [path.resolve(__dirname, 'entities', '**', '*.entity.{ts,js}')],
  migrations: [path.resolve(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  // AuditSubscriber is a NestJS @Injectable — it cannot be loaded via glob here.
  // It self-registers via dataSource.subscribers.push(this) inside NestJS DI.
});
