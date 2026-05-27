import * as fs from 'node:fs';

import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { resolveEnvFilePath } from '../config/env-file.config';

// Load the env file matching DEPLOY_ENV (.env.prod / .env.dev / .env.local).
// On VPS, compose mounts .env.dev|.env.prod at /app; skip silently if missing (local tooling).
const envFilePath = resolveEnvFilePath();
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

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
