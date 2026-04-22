import { EnvironmentsService } from '@common/modules/environments';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';
import { Readable } from 'stream';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  // Use preParsing hook to capture the raw body buffer for webhook HMAC
  // verification (Polar / Stripe). This hook fires BEFORE the content-type
  // parser, so there is no registration conflict with Fastify's built-in
  // 'application/json' parser. We consume the incoming stream, store the raw
  // bytes on the request, then return a new Readable so the JSON parser can
  // still parse req.body normally for all other routes.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('preParsing', async (request, _reply, payload) => {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as unknown as AsyncIterable<Buffer | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      const rawBody = Buffer.concat(chunks);
      (request as unknown as Record<string, unknown>)['rawBody'] = rawBody;
      return Readable.from(rawBody);
    });

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
      .addTag('Projects - Business')
      .addTag('Projects - Consultant')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    // Inject x-device-id as a required header parameter into every Swagger operation.
    // This reflects the device-binding check in JwtContextMiddleware — authenticated
    // requests must carry the same deviceId that was embedded in the JWT at sign-in.
    for (const pathItem of Object.values(document.paths)) {
      for (const operation of Object.values(pathItem)) {
        if (operation && typeof operation === 'object' && 'responses' in operation) {
          const op = operation as { parameters?: unknown[] };
          if (!Array.isArray(op.parameters)) {
            op.parameters = [];
          }
          op.parameters.push({
            name: 'x-device-id',
            in: 'header',
            required: true,
            description:
              'Device identifier bound to the JWT at sign-in (device-binding security check).',
            schema: { type: 'string', example: '123' },
          });
        }
      }
    }

    SwaggerModule.setup('api/v1/docs', app, document);
    console.log(`Swagger docs available at http://localhost:${envService.port}/api/v1/docs`);
  }

  await app.listen(envService.port, '0.0.0.0');
}

bootstrap();
