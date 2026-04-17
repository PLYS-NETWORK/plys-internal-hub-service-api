# Skill: Strict Validation & Over-posting Protection

## Global Pipe Enforcement
When initializing or modifying the `ValidationPipe`, Claude MUST enforce:
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,               // Strip non-decorated properties
  forbidNonWhitelisted: true,    // Throw error if extra fields are present
  transform: true,               // Automatically transform payloads to DTO instances
}));

## DTO Requirements
Every DTO property must have at least one validation decorator (e.g., @IsString(), @IsInt()).

Use @ApiProperty() for all fields to ensure Swagger documentation is accurate.

Use @Exclude() on sensitive Entity fields (passwords, internal IDs).