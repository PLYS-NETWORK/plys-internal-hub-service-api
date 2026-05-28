# Admin Auth API

> HTTP edge owner: `apps/api-gateway/src/http/v1/identity/admin-auth.controller.ts`
> Identity-service owns auth/session domain logic behind gRPC operations.

OTP-based passwordless login for the admin internal hub. The admin flow is intentionally distinct from `business` and `consultant`:

- **No self-registration** — admin accounts must be on the active whitelist (`admin_allowed_emails`). See [`admin-allowed-emails-api-specs.md`](./admin-allowed-emails-api-specs.md).
- **No password** — every sign-in uses a one-time email OTP.
- **Required device binding** — `verify-otp` rejects requests without `x-device-id` and `x-fingerprint`; both values are persisted on the session record (and the JWT) so admin sessions are device-bound.

**Base path:** `/api/v1/admin/auth`
**`active_platform` value:** `admin_platform`

After sign-in, session lifecycle uses the shared endpoints documented in [`auth-api-specs.md`](./auth-api-specs.md) (`/auth/refresh`, `/auth/logout`, `/auth/me`).

Successful responses are wrapped by the global `TransformResponseInterceptor`. Error responses follow the same envelope with `error_code` populated and HTTP `status_code` matching the failure.

---

## Flow

1. `POST /admin/auth/request-otp` — submit admin email + `active_platform=admin_platform`. The server verifies the email is on the active whitelist and dispatches a fresh 6-digit OTP. Previously issued unused OTPs for that admin are invalidated in the same call. If the email is **not** whitelisted the request fails with `403 ADMIN_AUTH_EMAIL_NOT_ALLOWED` (the request does _not_ silently succeed — the admin frontend uses this to gate the form).
2. `POST /admin/auth/verify-otp` — submit email + OTP + `active_platform=admin_platform` along with the **required** `x-device-id` and `x-fingerprint` headers. On success, returns `access_token`, `refresh_token`, `expires_in`, and the admin `user`.
3. Subsequent requests use the shared [`/auth/refresh`](./auth-api-specs.md#post-authrefresh), [`/auth/logout`](./auth-api-specs.md#post-authlogout), and [`/auth/me`](./auth-api-specs.md#get-authme) endpoints.

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

**200 OK** — OTP valid, session tokens returned. `data` is the [Auth Response](./auth-api-specs.md#auth-response) shape.

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

## Admin JWT notes

The access JWT issued by `verify-otp` carries `role=admin_platform`, `deviceId`, and `sessionId`. See the shared [Auth Response](./auth-api-specs.md#auth-response) contract for the full token pair shape.

---

## Error code reference

| `error_code`                   | HTTP | Where it fires                                                             |
| ------------------------------ | ---- | -------------------------------------------------------------------------- |
| `ADMIN_AUTH_EMAIL_NOT_ALLOWED` | 403  | `request-otp` / `verify-otp` — email is not on the active admin whitelist  |
| `ADMIN_AUTH_OTP_INVALID`       | 401  | `verify-otp` — OTP not found, wrong, already used, or expired (10-min TTL) |
| `ADMIN_AUTH_OTP_LOCKED`        | 429  | `verify-otp` — 5 wrong submissions for this email; rolling 1-hour lock     |
| `ADMIN_AUTH_RESEND_LIMIT`      | 429  | `request-otp` — per-email resend cap exceeded (3 / 30 min or 10 / 24 h)    |
| `GENERIC_BAD_REQUEST`          | 400  | `verify-otp` — `x-device-id` or `x-fingerprint` header missing             |
| `GENERIC_FORBIDDEN`            | 403  | `verify-otp` — admin user row exists but `is_active = false`               |
| `GENERIC_VALIDATION_FAILED`    | 422  | DTO validation failure (class-validator)                                   |
| `AUTH_RATE_LIMITED`            | 429  | Controller throttle exceeded (3 req / 60 min for admin OTP routes)         |

Shared session error codes (`AUTH_TOKEN_INVALID`, `AUTH_TOKEN_EXPIRED`, etc.) are documented in [`auth-api-specs.md`](./auth-api-specs.md#error-code-reference).

---

## Cross-links

- **Allow-list management:** [`admin-allowed-emails-api-specs.md`](./admin-allowed-emails-api-specs.md)
- **Shared session lifecycle:** [`auth-api-specs.md`](./auth-api-specs.md)
- **Platform auth (business / consultant):** [`platform-auth-api-specs.md`](./platform-auth-api-specs.md)
