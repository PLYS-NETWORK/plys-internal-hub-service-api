# Swagger Documentation

Use Swagger for API documentation.

Tool:

@nestjs/swagger

Goals:

- document endpoints
- generate API spec
- help frontend integration

Setup example:

const config = new DocumentBuilder()
  .setTitle('API')
  .setDescription('Backend API')
  .setVersion('1.0')
  .addBearerAuth()
  .build()

const document = SwaggerModule.createDocument(app, config)

SwaggerModule.setup('docs', app, document)