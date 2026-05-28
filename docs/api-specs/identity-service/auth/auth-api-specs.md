# Auth API — Shared Session Lifecycle

> HTTP edge owner: `apps/api-gateway/src/http/v1/identity/auth.controller.ts`
> Identity-service owns auth/session domain logic behind gRPC operations.

This document covers **session endpoints shared by every platform** (admin, business, consultant). Platform-specific sign-in flows live in sibling specs:

| Spec                                                                               | Scope                                                                   |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`admin-auth-api-specs.md`](./admin-auth-api-specs.md)                             | Admin OTP login at `/admin/auth/*`                                      |
| [`platform-auth-api-specs.md`](./platform-auth-api-specs.md)                       | Business & consultant register, login, SSO, password reset at `/auth/*` |
| [`consultant-account-gates-api-specs.md`](./consultant-account-gates-api-specs.md) | Consultant onboarding block & CopyLeaks ban gates                       |
| [`admin-allowed-emails-api-specs.md`](./admin-allowed-emails-api-specs.md)         | Admin allow-list management                                             |

**Base path:** `/api/v1/auth`

All request and response payloads are `snake_case`. Successful responses are wrapped by the global `TransformResponseInterceptor`:

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": { ... },
  "timestamp": "2026-05-17T00:00:00.000Z",
  "path": "/api/v1/auth/<route>"
}
```

Error responses follow the same envelope with `error_code` populated and HTTP `status_code` matching the failure. `details` is present for errors that carry contextual data.

---

## Throttling tiers (shared session endpoints)

| Tier          | Limit         | Applied to     |
| ------------- | ------------- | -------------- |
| `INTERACTIVE` | 30 req / 60 s | `refresh`      |
| `DEFAULT`     | 60 req / 60 s | `logout`, `me` |

Platform-specific throttling for register, login, SSO, etc. is documented in [`platform-auth-api-specs.md`](./platform-auth-api-specs.md).

---

## Endpoints

### POST /auth/refresh

Rotate the refresh token and issue a fresh access/refresh pair. Single-use: the supplied refresh token is invalidated on success, and detected reuse revokes every session for the user.

Used by **all platforms** after any sign-in path (`/admin/auth/verify-otp`, `/auth/login`, `/auth/verify-email`, SSO exchange, etc.).

The refresh token is read from **the request body**, not the `Authorization` header. The JWT signature is verified by Passport (`jwt-refresh` strategy) before the controller runs.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request body

```json
{
  "refresh_token": "eyJhbGci..."
}
```

| Field           | Type     | Constraints                                                                      |
| --------------- | -------- | -------------------------------------------------------------------------------- |
| `refresh_token` | `string` | Refresh JWT issued by a previous sign-in or `/auth/refresh` call on any platform |

#### Responses

**200 OK** — new session tokens returned. `data` is the [Auth Response](#auth-response) shape.

**Error responses**

| HTTP | `error_code`                | When                                                                                |
| ---- | --------------------------- | ----------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`      | Refresh JWT signature invalid, missing, or expired (rejected at the Passport guard) |
| 401  | `AUTH_TOKEN_INVALID`        | JWT validates but no matching active session is found (already rotated / replay)    |
| 401  | `AUTH_TOKEN_EXPIRED`        | Session row exists but `expires_at` has passed                                      |
| 422  | `GENERIC_VALIDATION_FAILED` | Body failed validation                                                              |
| 429  | `AUTH_RATE_LIMITED`         | INTERACTIVE throttle exceeded (30 req / 60 s)                                       |

> **Replay handling.** When the supplied refresh token matches a session whose `used_at` is already set, the server treats this as a replay attempt and revokes **all** sessions for that user before returning `AUTH_TOKEN_INVALID`. The user must sign in again on every device.

---

### POST /auth/logout

Revoke the current session. Requires `Authorization: Bearer <access_token>`.

#### Request body

_None._

#### Responses

**200 OK** — session revoked. `data` is `null`.

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/auth/logout"
}
```

**Error responses**

| HTTP | `error_code`           | When                            |
| ---- | ---------------------- | ------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED` | Missing or invalid access token |

---

### GET /auth/me

Return the authenticated user's profile. Requires `Authorization: Bearer <access_token>`.

The shape is the same for every platform; the underlying `users.role` and JWT claims differ by platform.

#### Responses

**200 OK** — `data` is a [User Response](#user-response).

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "is_email_verified": true,
    "is_active": true
  },
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/auth/me"
}
```

**Error responses**

| HTTP | `error_code`           | When                                                       |
| ---- | ---------------------- | ---------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED` | Missing or invalid access token                            |
| 404  | `AUTH_USER_NOT_FOUND`  | The user the JWT refers to has been deleted or deactivated |

---

## Auth Response

Shape of the `data` field for any sign-in or refresh call across all platforms:

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "expires_in": 900,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "is_email_verified": true,
      "is_active": true
    }
  },
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/auth/refresh"
}
```

### Response interface (snake_case JSON contract)

```ts
interface IAuthResponse {
  access_token: string; // signed access JWT (HS256)
  refresh_token: string; // signed refresh JWT (HS256, single-use, rotated by /auth/refresh)
  expires_in: number; // access-token TTL in seconds (default 900)
  user: IUserResponse;
}
```

**Platform-specific JWT payload notes:**

| Platform         | Extra access-JWT claims                                           |
| ---------------- | ----------------------------------------------------------------- |
| `admin_platform` | `role`, `deviceId`, `sessionId` — admin sessions are device-bound |
| `business`       | `businessId` — fast path for business-scoped request context      |
| `consultant`     | Standard user/session claims only                                 |

### User Response

```ts
interface IUserResponse {
  id: string;
  email: string;
  is_email_verified: boolean;
  is_active: boolean;
}
```

| Field               | Type      | Description                          |
| ------------------- | --------- | ------------------------------------ |
| `id`                | `string`  | User UUID                            |
| `email`             | `string`  | User email address                   |
| `is_email_verified` | `boolean` | Whether the email has been verified  |
| `is_active`         | `boolean` | `false` when the account is disabled |

---

## Error code reference

Codes raised by the shared session endpoints above, plus cross-cutting auth errors referenced from platform specs:

| `error_code`                | HTTP | Where it fires                                                                                                  |
| --------------------------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| `GENERIC_UNAUTHORIZED`      | 401  | Missing/invalid access JWT on `/auth/me`, `/auth/logout`; refresh JWT failed Passport on `/auth/refresh`        |
| `GENERIC_VALIDATION_FAILED` | 422  | DTO validation failure (class-validator)                                                                        |
| `AUTH_TOKEN_INVALID`        | 401  | `/auth/refresh` — refresh JWT validates but no matching active session is found                                 |
| `AUTH_TOKEN_EXPIRED`        | 401  | `/auth/refresh` — session row exists but `expires_at` has passed                                                |
| `AUTH_USER_NOT_FOUND`       | 404  | `/auth/me` — user deleted or deactivated                                                                        |
| `AUTH_RATE_LIMITED`         | 429  | Endpoint throttle exceeded (30 req / 60 s for `/auth/refresh`; 60 req / 60 s for `/auth/logout` and `/auth/me`) |

Platform-specific and admin-specific error codes are documented in [`platform-auth-api-specs.md`](./platform-auth-api-specs.md#error-code-reference) and [`admin-auth-api-specs.md`](./admin-auth-api-specs.md#error-code-reference) respectively.
