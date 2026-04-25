import { HEADERS } from '@common/constants';
import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Marketplace API')
  .setDescription('Marketplace backend API documentation')
  .setVersion('1.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
  // Registers x-device-id as a named API key scheme so it appears in the
  // Swagger "Authorize" dialog alongside the Bearer token. Enter once → sent
  // with every request. addSecurityRequirements applies it globally.
  .addApiKey(
    {
      type: 'apiKey',
      in: 'header',
      name: HEADERS.X_DEVICE_ID,
      description: 'Device identifier for session binding',
    },
    HEADERS.X_DEVICE_ID,
  )
  .addSecurityRequirements(HEADERS.X_DEVICE_ID)
  .build();
