# Rule: API Design — Request & Response Conventions

## 1. Key Naming: snake_case in All JSON Payloads
- All JSON request and response fields **must** use `snake_case` (e.g., `first_name`, `created_at`).
- Never expose `camelCase` keys (TypeScript property names) in the HTTP layer.

### Request DTOs
Use `@Transform` from `class-transformer` and `@ApiProperty({ name: 'snake_key' })` to accept snake_case:
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ name: 'first_name', example: 'John' })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['first_name'])
  @IsString()
  readonly firstName: string;
}
```

> Rationale: `ValidationPipe` uses `class-transformer` internally. The `@Transform` decorator maps
> the incoming snake_case key to the camelCase TypeScript property before validation runs.

### Response DTOs
Apply `@Exclude()` at the class level and `@Expose()` per field to control output shape:
```typescript
import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({ name: 'id' })
  readonly id: number;

  @Expose({ name: 'first_name' })
  @ApiProperty({ name: 'first_name', example: 'John' })
  readonly firstName: string;
}
```

Enable `ClassSerializerInterceptor` globally in `main.ts` so `@Exclude` / `@Expose` are applied
to every controller response automatically:
```typescript
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

---

## 2. Return Only Necessary Data
- **Never** return raw TypeORM Entity objects from controllers.
- Always project through a `*ResponseDto` class.
- Fields to exclude from all responses:
  - `password_hash` / `passwordHash`
  - Internal audit fields not relevant to the caller (`created_at`, `updated_at` unless specifically needed)
  - Nested entity relations that were not explicitly requested
  - Any column marked `select: false` in the entity

### Projection Pattern
```typescript
// ❌ Wrong — exposes all entity columns including passwordHash
return user;

// ✅ Correct — explicit projection using plainToInstance
import { plainToInstance } from 'class-transformer';

return plainToInstance(UserResponseDto, user, {
  excludeExtraneousValues: true,
});
```

### Service-layer rule
Services must return **typed** objects (`UserResponseDto`, not `User`).  
The controller receives an already-projected DTO and wraps it in `ITranslatedPayload`.

---

## 3. Standardized Response Envelope
All responses are wrapped by `TransformResponseInterceptor` into:
```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": { ... },
  "timestamp": "2026-04-18T00:00:00.000Z",
  "path": "/api/v1/users"
}
```
- `error_code` is `null` on success and a value from `ERROR_CODES` on errors.
- Controllers must **never** construct this envelope manually; rely on the interceptor.

---

## 4. Error Response Shape
On errors, `GlobalExceptionFilter` populates `error_code` using constants from
`src/common/constants/error-codes.ts`. Services should throw `TranslatableException` with:
```typescript
throw new TranslatableException({
  messageKey: 'error.auth.invalid_credentials',
  errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
  status: HttpStatus.UNAUTHORIZED,
});
```

---

## 5. Pagination
Paginated endpoints accept:
- `page` (number, default 1)
- `take` (number, default 20, max 100)

Paginated responses wrap items in:
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "take": 20,
    "item_count": 42,
    "page_count": 3,
    "has_previous_page": false,
    "has_next_page": true
  }
}
```
