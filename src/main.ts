import { EnvironmentsService } from '@common/modules/environments';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SwaggerModule } from '@nestjs/swagger';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';
import * as path from 'path';

import { AppModule } from './app.module';
import { swaggerConfig } from './config/swagger.config';
import {
  ADMIN_DOC_TAGS,
  BUSINESS_DOC_TAGS,
  CONSULTANT_DOC_TAGS,
  filterDocumentByTags,
} from './config/swagger-filter.util';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    // rawBody: true tells NestJS to capture the raw request body as a Buffer
    // alongside the parsed body. Required for webhook HMAC signature
    // verification (Polar / Stripe). Accessible via req.rawBody.
    { rawBody: true },
  );

  // Security & compression plugins
  await app.register(import('@fastify/helmet') as never);
  await app.register(import('@fastify/compress') as never);
  await app.register(import('@fastify/cookie') as never);

  const envService = app.get(EnvironmentsService);

  // Multipart upload — limits.fileSize aborts the stream the instant the
  // configured cap is exceeded, so bytes never reach memory or disk.
  await app.register(import('@fastify/multipart') as never, {
    limits: {
      fileSize: envService.filesMaxSizeBytes,
      files: 1,
      fields: 10,
      fieldNameSize: 100,
    },
  });

  // Serve files written by the local storage provider. The base URL
  // matches FILES_LOCAL_PUBLIC_BASE_URL so the URLs handed back from
  // FilesService.getById resolve correctly.
  await app.register(import('@fastify/static') as never, {
    root: path.resolve(envService.filesLocalPath),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // CORS
  app.enableCors({
    origin: envService.allowedOrigins,
    credentials: true,
  });

  // Socket.IO adapter — Fastify does not include one by default. Without this,
  // @WebSocketGateway() classes never bind to the underlying HTTP listener.
  // Also note: WS handshake CORS is controlled inside the gateway decorator —
  // app.enableCors() above only governs HTTP traffic.
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global API prefix and URI-based versioning (/api/v1/...)
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Strict validation — strips extra fields, transforms payloads to DTO instances,
  // translates constraint messages using keys from src/i18n/<lang>/validation.json.
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // Formats i18n validation errors into the StandardizedResponse shape.
  app.useGlobalFilters(
    new I18nValidationExceptionFilter({
      detailedErrors: false,
    }),
  );

  if (!envService.isProduction) {
    const fullDocument = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/v1/docs', app, fullDocument);

    SwaggerModule.setup('api/v1/business/docs', app, () =>
      filterDocumentByTags(fullDocument, BUSINESS_DOC_TAGS, 'Marketplace API — Business'),
    );

    SwaggerModule.setup('api/v1/consultant/docs', app, () =>
      filterDocumentByTags(fullDocument, CONSULTANT_DOC_TAGS, 'Marketplace API — Consultant'),
    );

    SwaggerModule.setup('api/v1/admin/docs', app, () =>
      filterDocumentByTags(fullDocument, ADMIN_DOC_TAGS, 'Marketplace API — Admin'),
    );

    console.log(
      `Swagger → full: /api/v1/docs | business: /api/v1/business/docs | consultant: /api/v1/consultant/docs | admin: /api/v1/admin/docs`,
    );
  }

  await app.listen(envService.port, '0.0.0.0');
}

bootstrap();
