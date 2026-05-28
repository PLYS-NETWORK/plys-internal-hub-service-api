# Admin Auth API

> HTTP edge owner: `apps/api-gateway/src/http/v1/identity/auth.controller.ts` (guards/middleware at gateway).
> Identity-service owns auth/session domain logic behind gRPC operations.

OTP-based passwordless login for the admin internal hub. The admin flow is intentionally distinct from `business` and `consultant`:

- **No self-registration** — admin accounts must be on the active whitelist (`admin_allowed_emails`).
- **No password** — every sign-in uses a one-time email OTP.
- **Required device binding** — `verify-otp` rejects requests without `x-device-id` and `x-fingerprint`; both values are persisted on the session record (and the JWT) so admin sessions are device-bound.

**Base path:** `/api/v1`
**`active_platform` value:** `admin_platform`

Successful responses are wrapped by the global `TransformResponseInterceptor`. Error responses follow the same envelope with `error_code` populated and HTTP `status_code` matching the failure.

---

## Flow

1. `POST /admin/auth/request-otp` — submit admin email + `active_platform=admin_platform`. The server verifies the email is on the active whitelist and dispatches a fresh 6-digit OTP. Previously issued unused OTPs for that admin are invalidated in the same call. If the email is **not** whitelisted the request fails with `403 ADMIN_AUTH_EMAIL_NOT_ALLOWED` (the request does _not_ silently succeed — the admin frontend uses this to gate the form).
2. `POST /admin/auth/verify-otp` — submit email + OTP + `active_platform=admin_platform` along with the **required** `x-device-id` and `x-fingerprint` headers. On success, returns `access_token`, `refresh_token`, `expires_in`, and the admin `user`.
3. Subsequent requests use the shared `/auth/refresh` and `/auth/logout` endpoints to rotate or revoke the session (same shape as the consultant/business platforms).

---

## Throttling & abuse controls

Both admin endpoints sit under the controller-level `THROTTLE_OTP` tier: **3 requests / 60 min** per (IP, email) combination. On top of that the service enforces stricter business limits:

| Counter                           | Limit          | When it trips                                                       |
| --------------------------------- | -------------- | ------------------------------------------------------------------- |
| Per-email resend (rolling 30 min) | 3 OTPs         | `request-otp` returns `429 ADMIN_AUTH_RESEND_LIMIT`                 |
| Per-email resend (rolling 24 h)   | 10 OTPs        | `request-otp` returns `429 ADMIN_AUTH_RESEND_LIMIT`                 |
| Per-email wrong OTP               | 5 failures     | `verify-otp` returns `429 ADMIN_AUTH_OTP_LOCKED`; lock TTL = 1 hour |
| Controller throttle               | 3 req / 60 min | Either endpoint returns `429 AUTH_RATE_LIMITED`                     |

---

## Endpoints

### POST /admin/auth/request-otp

Request a one-time login code. Auto-provisions a `users` row with `role=admin_platform` on first request for a whitelisted email.

#### Headers

| Header          | Required | Description                                             |
| --------------- | -------- | ------------------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier (not bound until verification) |
| `x-fingerprint` | No       | Client fingerprint (not bound until verification)       |

#### Request body

```json
{
  "email": "admin@plysnetwork.com",
  "active_platform": "admin_platform"
}
```

| Field             | Type     | Constraints                        |
| ----------------- | -------- | ---------------------------------- |
| `email`           | `string` | Valid email address                |
| `active_platform` | `string` | Must be exactly `"admin_platform"` |

#### Responses

**200 OK** — OTP dispatched. `data` is `null`.

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/admin/auth/request-otp"
}
```

**Error responses**

| HTTP | `error_code`                   | When                                                                    |
| ---- | ------------------------------ | ----------------------------------------------------------------------- |
| 403  | `ADMIN_AUTH_EMAIL_NOT_ALLOWED` | Email is not on the active admin whitelist                              |
| 422  | `GENERIC_VALIDATION_FAILED`    | Body failed validation (e.g. `active_platform` is not `admin_platform`) |
| 429  | `ADMIN_AUTH_RESEND_LIMIT`      | Per-email resend cap exceeded (3 / 30 min or 10 / 24 h)                 |
| 429  | `AUTH_RATE_LIMITED`            | Controller-level throttle exceeded (3 req / 60 min per IP+email)        |

---

### POST /admin/auth/verify-otp

Verify the OTP and receive session tokens. `x-device-id` and `x-fingerprint` are **mandatory** — the service rejects requests missing either header with `400 GENERIC_BAD_REQUEST`. Both values are persisted on the session row and embedded in the access JWT so the admin session is hardware-bound.

After **5 consecutive wrong OTP submissions** for the same email, the email is locked for **1 hour** (`ADMIN_AUTH_OTP_LOCKED`). The counter is cleared on the next successful verification.

#### Headers

| Header          | Required | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| `x-device-id`   | **Yes**  | Stable device identifier (embedded in the JWT)    |
| `x-fingerprint` | **Yes**  | Client fingerprint (stored in the session record) |

#### Request body

```json
{
  "email": "admin@plysnetwork.com",
  "otp": "483920",
  "active_platform": "admin_platform"
}
```

| Field             | Type     | Constraints                        |
| ----------------- | -------- | ---------------------------------- |
| `email`           | `string` | Valid email address                |
| `otp`             | `string` | Exactly 6 digits (`/^\d{6}$/`)     |
| `active_platform` | `string` | Must be exactly `"admin_platform"` |

#### Responses

**200 OK** — OTP valid, session tokens returned. `data` is the [Auth Response](#auth-response) shape.

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
      "email": "admin@plysnetwork.com",
      "is_email_verified": true,
      "is_active": true
    }
  },
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

**Error responses**

| HTTP | `error_code`                   | When                                                                                                                                                                      |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `GENERIC_BAD_REQUEST`          | `x-device-id` or `x-fingerprint` header is missing. `details.reason` describes the missing header.                                                                        |
| 401  | `ADMIN_AUTH_OTP_INVALID`       | OTP not found, wrong, already used, expired (10-min TTL), or the user record doesn't exist on the admin platform. Every failure increments the per-email lockout counter. |
| 403  | `ADMIN_AUTH_EMAIL_NOT_ALLOWED` | Email is no longer on the active admin whitelist (revoked between request and verify)                                                                                     |
| 403  | `GENERIC_FORBIDDEN`            | The admin user row exists but `users.is_active = false`                                                                                                                   |
| 422  | `GENERIC_VALIDATION_FAILED`    | Body failed validation                                                                                                                                                    |
| 429  | `ADMIN_AUTH_OTP_LOCKED`        | 5 wrong OTP attempts have already accumulated for this email; the lock auto-clears 1 hour after the first failure in the window                                           |
| 429  | `AUTH_RATE_LIMITED`            | Controller-level throttle exceeded (3 req / 60 min per IP+email)                                                                                                          |

---

### POST /auth/refresh

Rotate the refresh token and issue a fresh access/refresh pair. This endpoint is **shared with the consultant and business platforms** — the admin frontend uses it unchanged.

The refresh token is read from the request body (not the `Authorization` header). The JWT signature is verified by Passport (`jwt-refresh` strategy) before the controller runs.

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

| Field           | Type     | Constraints                                                                    |
| --------------- | -------- | ------------------------------------------------------------------------------ |
| `refresh_token` | `string` | Refresh JWT issued by `/admin/auth/verify-otp` (or a previous `/auth/refresh`) |

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

> **Replay handling.** When the supplied refresh token matches a session whose `used_at` is already set, the server treats this as a replay attempt and revokes **all** sessions for that user before returning `AUTH_TOKEN_INVALID`. The admin must sign in again on every device.

---

### POST /auth/logout

Revoke the current admin session. Requires `Authorization: Bearer <access_token>`.

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

Return the authenticated admin's profile. Requires `Authorization: Bearer <access_token>`. Shared with the other platforms — for admins this returns the `user` row with `role=admin_platform`.

#### Responses

**200 OK** — `data` is a [User Response](#user-response).

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@plysnetwork.com",
    "is_email_verified": true,
    "is_active": true
  },
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/auth/me"
}
```

**Error responses**

| HTTP | `error_code`           | When                                                      |
| ---- | ---------------------- | --------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED` | Missing or invalid access token                           |
| 404  | `AUTH_USER_NOT_FOUND`  | The admin record no longer exists or has been deactivated |

---

## Auth Response

Shape of the `data` field for `/admin/auth/verify-otp` and `/auth/refresh`:

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
      "email": "admin@plysnetwork.com",
      "is_email_verified": true,
      "is_active": true
    }
  },
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

### Response interface (snake_case JSON contract)

```ts
interface IAuthResponse {
  access_token: string; // signed access JWT (HS256). Carries `role=admin_platform`, `deviceId`, and `sessionId`.
  refresh_token: string; // signed refresh JWT (HS256, single-use, rotated by /auth/refresh)
  expires_in: number; // access-token TTL in seconds (default 900)
  user: IUserResponse;
}
```

### User Response

```ts
interface IUserResponse {
  id: string; // admin user UUID
  email: string;
  is_email_verified: boolean; // always true for admins (verified on auto-provision)
  is_active: boolean;
}
```

| Field               | Type      | Description                                           |
| ------------------- | --------- | ----------------------------------------------------- |
| `id`                | `string`  | Admin user UUID                                       |
| `email`             | `string`  | Admin email address (matches the whitelist entry)     |
| `is_email_verified` | `boolean` | Always `true` — admins are verified on auto-provision |
| `is_active`         | `boolean` | `false` when the admin has been disabled              |

---

## Error code reference

| `error_code`                   | HTTP | Where it fires                                                                                                                                         |
| ------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ADMIN_AUTH_EMAIL_NOT_ALLOWED` | 403  | `request-otp` / `verify-otp` — email is not on the active admin whitelist                                                                              |
| `ADMIN_AUTH_OTP_INVALID`       | 401  | `verify-otp` — OTP not found, wrong, already used, or expired (10-min TTL); also when the admin user row is missing                                    |
| `ADMIN_AUTH_OTP_LOCKED`        | 429  | `verify-otp` — 5 wrong submissions for this email; rolling 1-hour lock                                                                                 |
| `ADMIN_AUTH_RESEND_LIMIT`      | 429  | `request-otp` — per-email resend cap exceeded (3 / 30 min or 10 / 24 h)                                                                                |
| `GENERIC_BAD_REQUEST`          | 400  | `verify-otp` — `x-device-id` or `x-fingerprint` header missing                                                                                         |
| `GENERIC_FORBIDDEN`            | 403  | `verify-otp` — admin user row exists but `is_active = false`                                                                                           |
| `GENERIC_UNAUTHORIZED`         | 401  | Missing/invalid access JWT on `/auth/me`, `/auth/logout`; or refresh JWT failed Passport verification on `/auth/refresh`                               |
| `GENERIC_VALIDATION_FAILED`    | 422  | DTO validation failure (class-validator)                                                                                                               |
| `AUTH_TOKEN_INVALID`           | 401  | `/auth/refresh` — refresh JWT validates but no matching active session is found                                                                        |
| `AUTH_TOKEN_EXPIRED`           | 401  | `/auth/refresh` — session row exists but `expires_at` has passed                                                                                       |
| `AUTH_USER_NOT_FOUND`          | 404  | `/auth/me` — the admin record was deleted or deactivated                                                                                               |
| `AUTH_RATE_LIMITED`            | 429  | Controller throttle exceeded (3 req / 60 min for admin OTP routes; 30 req / 60 s for `/auth/refresh`; 60 req / 60 s for `/auth/logout` and `/auth/me`) |
