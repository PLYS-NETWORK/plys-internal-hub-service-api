import { EnvironmentsService } from '@common/modules/environments';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';

export function getTypeOrmConfig(envService: EnvironmentsService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: envService.dbHost,
    port: envService.dbPort,
    username: envService.dbUsername,
    password: envService.dbPassword,
    database: envService.dbName,
    // Schema sync is for local iteration only — deployed envs (dev + prod) rely on migrations.
    synchronize: envService.isLocal,
    logging: !envService.isProduction,
    entities: [path.resolve(__dirname, 'entities', '**', '*.entity.{ts,js}')],
    migrations: [path.resolve(__dirname, 'migrations', '*.{ts,js}')],
    // Subscribers are NOT listed here — AuditSubscriber is a NestJS provider
    // that self-registers via dataSource.subscribers.push(this) in its constructor.
    // Listing glob patterns here breaks TypeORM 0.3.x which expects class references.
    autoLoadEntities: true,
    // Run pending migrations on startup in every deployed env so the `migrations` table
    // is created and applied migrations are recorded in both development and production.
    migrationsRun: !envService.isLocal,
    migrationsTableName: 'migrations',
  };
}
