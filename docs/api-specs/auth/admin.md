# Admin Auth API

OTP-based passwordless login for the admin internal hub.

**Base path:** `/api/v1`

---

## Flow

1. `POST /admin/auth/request-otp` — submit admin email. The system validates the email against the whitelist and dispatches a 6-digit OTP. Always returns `200` regardless of whether the email is whitelisted (prevents enumeration).
2. `POST /admin/auth/verify-otp` — submit email + OTP. On success, returns `access_token`, `refresh_token`, `expires_in`, and `user`.

---

## Endpoints

### POST /admin/auth/request-otp

Request a one-time login code.

**Rate limits (per email)**

- 3 requests per 30 minutes
- 10 requests per 24 hours

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request Body

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

**200 OK** — OTP dispatched (or silently ignored if email not whitelisted)

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/request-otp"
}
```

**422 Unprocessable Entity** — validation error

```json
{
  "status_code": 422,
  "message": "Validation failed",
  "error_code": "GENERIC_VALIDATION_ERROR",
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/request-otp"
}
```

**429 Too Many Requests** — resend rate limit exceeded (`ADMIN_AUTH_RESEND_LIMIT`)

```json
{
  "status_code": 429,
  "message": "You have requested too many codes. Please wait before requesting a new one.",
  "error_code": "ADMIN_AUTH_RESEND_LIMIT",
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/request-otp"
}
```

---

### POST /admin/auth/verify-otp

Verify the OTP and receive session tokens.

`x-device-id` and `x-fingerprint` are **required** on this endpoint. After **5 consecutive wrong OTP submissions** for the same email, the email is locked for 1 hour.

#### Headers

| Header          | Required | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| `x-device-id`   | **Yes**  | Stable device identifier (embedded in the JWT)    |
| `x-fingerprint` | **Yes**  | Client fingerprint (stored in the session record) |

#### Request Body

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
| `otp`             | `string` | Exactly 6 digits                   |
| `active_platform` | `string` | Must be exactly `"admin_platform"` |

#### Responses

**200 OK** — OTP valid, session tokens returned

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
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

**400 Bad Request** — missing `x-device-id` or `x-fingerprint` header (`GENERIC_BAD_REQUEST`)

```json
{
  "status_code": 400,
  "message": "Bad Request",
  "error_code": "GENERIC_BAD_REQUEST",
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

**401 Unauthorized** — OTP is wrong, expired, or already used (`ADMIN_AUTH_OTP_INVALID`)

```json
{
  "status_code": 401,
  "message": "The verification code is invalid or has expired.",
  "error_code": "ADMIN_AUTH_OTP_INVALID",
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

**403 Forbidden** — admin account is inactive (`GENERIC_FORBIDDEN`)

```json
{
  "status_code": 403,
  "message": "Forbidden",
  "error_code": "GENERIC_FORBIDDEN",
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

**422 Unprocessable Entity** — validation error

```json
{
  "status_code": 422,
  "message": "Validation failed",
  "error_code": "GENERIC_VALIDATION_ERROR",
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

**429 Too Many Requests** — email locked after 5 failed OTP attempts (`ADMIN_AUTH_OTP_LOCKED`)

```json
{
  "status_code": 429,
  "message": "Your account has been temporarily locked due to too many failed attempts. Please try again later.",
  "error_code": "ADMIN_AUTH_OTP_LOCKED",
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/admin/auth/verify-otp"
}
```

---

## Error Codes

| Code                       | HTTP | Description                                                   |
| -------------------------- | ---- | ------------------------------------------------------------- |
| `ADMIN_AUTH_OTP_INVALID`   | 401  | OTP is wrong, expired, or already used                        |
| `ADMIN_AUTH_OTP_LOCKED`    | 429  | Email locked after 5 consecutive wrong attempts (1-hour lock) |
| `ADMIN_AUTH_RESEND_LIMIT`  | 429  | Per-email resend rate limit exceeded                          |
| `GENERIC_BAD_REQUEST`      | 400  | `x-device-id` or `x-fingerprint` header missing               |
| `GENERIC_FORBIDDEN`        | 403  | Admin account is inactive                                     |
| `GENERIC_VALIDATION_ERROR` | 422  | Request body failed class-validator validation                |
