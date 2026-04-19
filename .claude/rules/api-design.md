# Rule: API Design — Request & Response Conventions

## 1. Key Naming: snake_case in All JSON Payloads
- All JSON request and response fields **must** use `snake_case` (e.g., `first_name`, `created_at`).
- Never expose `camelCase` keys (TypeScript property names) in the HTTP layer.

## 2. DTO Folder Structure (Mandatory)
All DTOs must live in `dto/requests/` and `dto/responses/` subfolders:
```
src/modules/<feature>/dto/
├── requests/
│   ├── *.request.interface.ts   ← TypeScript interface (camelCase — matches internal shape)
│   └── *.dto.ts                 ← class implementing the interface
└── responses/
    ├── *.response.interface.ts  ← TypeScript interface (snake_case — matches JSON output)
    └── *-response.dto.ts        ← class implementing the interface
```

## 3. Interface Requirement (Mandatory)
Every DTO class **must** implement a corresponding TypeScript interface:
- **Request interface**: camelCase properties (describes the TS-internal shape after transformation)
- **Response interface**: snake_case properties (describes the JSON output contract)

## 4. Request DTOs
Use `@Expose({ name: 'snake_key' })` from `class-transformer` to accept snake_case input.
class-transformer maps the source key `snake_key` to the camelCase TypeScript property during `plainToInstance` (called internally by `ValidationPipe` with `transform: true`).

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

import { ICreateUserRequest } from './create-user.request.interface';

export class CreateUserDto implements ICreateUserRequest {
  @Expose({ name: 'first_name' })
  @ApiProperty({ name: 'first_name', example: 'John' })
  @IsString()
  public readonly firstName!: string;
}
```

> **Why `@Expose` instead of `@Transform`:** `@Expose({ name })` is the declarative standard —
> it tells class-transformer which source key this property maps to without side effects.
> `@Transform` is reserved for value transformations (type coercion, computed values), not key mapping.

## 5. Response DTOs
Response DTOs have **snake_case TypeScript property names** (matching the snake_case interface).
Use `@Expose()` (no rename needed — TS property name IS the JSON key).
For entity → DTO mapping, **construct a plain snake_case object in the service** before calling `plainToInstance`:

```typescript
// In the service — explicit snake_case mapping from camelCase entity
return plainToInstance(
  UserResponseDto,
  {
    id: user.id,
    email: user.email,
    is_email_verified: user.isEmailVerified,
    is_active: user.isActive,
  },
  { excludeExtraneousValues: true },
);
```

```typescript
import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { IUserResponse } from './user-response.response.interface';

@Exclude()
export class UserResponseDto implements IUserResponse {
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  public readonly id!: string;

  @Expose()
  @ApiProperty({ name: 'is_email_verified', example: true })
  public readonly is_email_verified!: boolean;
}
```

Alternatively, when the source already uses camelCase (e.g., entity passed directly), use
`@Transform(({ obj }) => obj['camelCaseKey'])` on the snake_case property:

```typescript
@Expose()
@Transform(({ obj }: { obj: Record<string, unknown> }) => obj['isEmailVerified'])
public readonly is_email_verified!: boolean;
```

---

## 6. Return Only Necessary Data
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

return plainToInstance(UserResponseDto, mappedPlainObject, {
  excludeExtraneousValues: true,
});
```

### Service-layer rule
Services must return **typed** objects (`UserResponseDto`, not `User`).
The controller receives an already-projected DTO and wraps it in `ITranslatedPayload`.

---

## 7. Standardized Response Envelope
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

## 8. Error Response Shape
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

## 9. Pagination
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
