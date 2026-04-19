import { EnvironmentsService } from '@common/modules/environments';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  // Security & compression plugins
  await app.register(import('@fastify/helmet') as never);
  await app.register(import('@fastify/compress') as never);
  await app.register(import('@fastify/cookie') as never);

  const envService = app.get(EnvironmentsService);

  // CORS
  app.enableCors({
    origin: envService.allowedOrigins,
    credentials: true,
  });

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
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Marketplace API')
      .setDescription('Marketplace backend API documentation')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .addTag('Auth')
      .addTag('Users')
      .addTag('Business Profiles')
      .addTag('Consultant Profiles')
      .addTag('Projects')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, document);
    console.log(`Swagger docs available at http://localhost:${envService.port}/api/v1/docs`);
  }

  await app.listen(envService.port, '0.0.0.0');
}

bootstrap();
