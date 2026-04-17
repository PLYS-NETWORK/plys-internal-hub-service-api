import * as path from 'path';

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import 'dotenv/config';

export function getTypeOrmConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_NAME ?? 'marketplace',
    synchronize: false,
    logging: process.env.NODE_ENV !== 'production',
    entities: [path.resolve(__dirname, 'entities', '*.entity.{ts,js}')],
    migrations: [path.resolve(__dirname, 'migrations', '*.{ts,js}')],
    autoLoadEntities: true,
    migrationsRun: false,
  };
}
