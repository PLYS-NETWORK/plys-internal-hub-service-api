import * as path from 'path';

import 'dotenv/config';
import { DataSource } from 'typeorm';

// Standalone DataSource for TypeORM CLI (migration:generate, migration:run, etc.)
// Not used by NestJS DI — AppModule uses TypeOrmModule.forRootAsync instead.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'password',
  database: process.env.DB_NAME ?? 'marketplace',
  synchronize: false,
  logging: true,
  entities: [path.resolve(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [path.resolve(__dirname, 'migrations', '*.{ts,js}')],
});
