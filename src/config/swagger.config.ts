import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
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
