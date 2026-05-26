import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SwaggerModule } from '@nestjs/swagger';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';
import * as path from 'path';

import { AppModule } from './app.module';
import { swaggerConfig } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { rawBody: true, bufferLogs: true },
  );

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useWebSocketAdapter(new IoAdapter(app));

  const envService = app.get(EnvironmentsService);

  if (envService.filesStorageProvider === 'local') {
    await app.register(import('@fastify/static') as never, {
      root: path.resolve(envService.filesLocalPath),
      prefix: '/uploads/',
      decorateReply: false,
    });
  }

  await app.register(import('@fastify/helmet') as never);
  await app.register(import('@fastify/compress') as never);
  await app.register(import('@fastify/cookie') as never);
  await app.register(import('@fastify/multipart') as never, {
    limits: { fileSize: envService.filesMaxSizeBytes },
  });

  app.enableCors({
    origin: envService.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(
    new I18nValidationExceptionFilter({
      detailedErrors: false,
    }),
  );

  if (!envService.isProduction) {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, document);
    // eslint-disable-next-line no-console
    console.log('Swagger → /api/v1/docs');
  }

  await app.listen(envService.port, '0.0.0.0');
}

void bootstrap();
