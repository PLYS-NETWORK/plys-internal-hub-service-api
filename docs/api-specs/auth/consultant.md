# Consultant Auth API

Authentication endpoints for the Consultant platform.

**Base path:** `/api/v1`  
**`active_platform` value:** `consultant`

---

## Endpoints

### POST /auth/register

Register a new consultant account. Sends a verification email on success.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request Body

```json
{
  "email": "jane@example.com",
  "password": "P@ssword123",
  "active_platform": "consultant",
  "full_name": "Jane Doe"
}
```

| Field             | Type     | Constraints                                                 |
| ----------------- | -------- | ----------------------------------------------------------- |
| `email`           | `string` | Valid email address                                         |
| `password`        | `string` | Min 8 chars, must contain uppercase, lowercase, and a digit |
| `active_platform` | `string` | Must be `"consultant"`                                      |
| `full_name`       | `string` | Required when `active_platform` is `consultant`             |

#### Responses

**201 Created** — account created, verification email dispatched

```json
{
  "status_code": 201,
  "message": "Created",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

**409 Conflict** — email already registered (`AUTH_EMAIL_ALREADY_EXISTS`)

**422 Unprocessable Entity** — validation error (`GENERIC_VALIDATION_ERROR`)

---

### POST /auth/verify-email

Verify email using the token from the verification link.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request Body

```json
{
  "token": "<verification-token>",
  "active_platform": "consultant"
}
```

#### Responses

**200 OK** — email verified, session tokens returned → [Auth Response](#auth-response)

**401 Unauthorized** — token invalid or expired (`AUTH_INVALID_TOKEN`)

**422 Unprocessable Entity** — validation error

---

### POST /auth/resend-verification

Resend the email verification link. Always returns `200` regardless of whether the account exists (prevents enumeration).

#### Request Body

```json
{
  "email": "jane@example.com",
  "active_platform": "consultant"
}
```

#### Responses

**200 OK** — verification email dispatched (or silently ignored)

**422 Unprocessable Entity** — validation error

---

### POST /auth/login

Login with email and password.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request Body

```json
{
  "email": "jane@example.com",
  "password": "P@ssword123",
  "active_platform": "consultant"
}
```

#### Responses

**200 OK** — login successful → [Auth Response](#auth-response)

**401 Unauthorized** — wrong email or password (`AUTH_INVALID_CREDENTIALS`)

**403 Forbidden** — account is inactive (`GENERIC_FORBIDDEN`)

**422 Unprocessable Entity** — validation error

---

### POST /auth/refresh

Refresh the access token using a refresh token.

Requires `Authorization: Bearer <refresh_token>` header.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `Authorization` | **Yes**  | `Bearer <refresh_token>`                        |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request Body

```json
{
  "refresh_token": "eyJhbGci..."
}
```

#### Responses

**200 OK** — new session tokens returned → [Auth Response](#auth-response)

**401 Unauthorized** — refresh token invalid or expired (`AUTH_INVALID_TOKEN`)

---

### POST /auth/logout

Revoke the current session.

Requires `Authorization: Bearer <access_token>` header.

#### Responses

**200 OK** — session revoked

**401 Unauthorized** — missing or invalid access token

---

### POST /auth/forgot-password

Request a password-reset OTP. Always returns `200` regardless of whether the account exists (prevents enumeration). Rate limited to **3 requests per hour per email**.

#### Request Body

```json
{
  "email": "jane@example.com",
  "active_platform": "consultant"
}
```

#### Responses

**200 OK** — reset OTP dispatched (or silently ignored)

**422 Unprocessable Entity** — validation error

---

### POST /auth/reset-password

Reset password using the OTP received by email. Revokes all existing sessions on success.

#### Request Body

```json
{
  "email": "jane@example.com",
  "otp": "391827",
  "new_password": "NewP@ssword123",
  "active_platform": "consultant"
}
```

| Field             | Type     | Constraints                                                 |
| ----------------- | -------- | ----------------------------------------------------------- |
| `email`           | `string` | Valid email address                                         |
| `otp`             | `string` | Exactly 6 digits                                            |
| `new_password`    | `string` | Min 8 chars, must contain uppercase, lowercase, and a digit |
| `active_platform` | `string` | Must be `"consultant"`                                      |

#### Responses

**200 OK** — password reset, all sessions revoked

**401 Unauthorized** — OTP invalid or expired (`AUTH_INVALID_TOKEN`)

**422 Unprocessable Entity** — validation error

---

### GET /auth/sso/google

Initiate Google OAuth redirect. Pass `active_platform=consultant` as a query parameter.

#### Query Parameters

| Parameter         | Required | Description                                                          |
| ----------------- | -------- | -------------------------------------------------------------------- |
| `active_platform` | No       | `consultant` — stored in the CSRF state record, used in the callback |

#### Response

**302 Redirect** — forwards to Google OAuth consent screen

---

### POST /auth/sso/exchange

Exchange a single-use SSO code for session tokens. The `code` is obtained from the redirect URL after `/auth/sso/google/callback` completes. Each code is valid **once** for a short TTL (~60 seconds).

#### Request Body

```json
{
  "code": "<single-use-exchange-code>"
}
```

#### Responses

**200 OK** — session tokens returned → [Auth Response](#auth-response)

**401 Unauthorized** — code is invalid or expired (`AUTH_INVALID_TOKEN`)

---

### POST /auth/sso/google/token

Exchange a Google ID token for platform session tokens. For clients that run the Google OAuth flow natively (SPA, mobile).

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request Body

```json
{
  "id_token": "eyJhbGci...",
  "active_platform": "consultant"
}
```

#### Responses

**200 OK** — session tokens returned → [Auth Response](#auth-response)

**401 Unauthorized** — Google ID token rejected (`AUTH_INVALID_TOKEN`)

**422 Unprocessable Entity** — validation error

---

## Auth Response

Shape returned by `/login`, `/verify-email`, `/refresh`, `/sso/exchange`, and `/sso/google/token`:

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
      "email": "jane@example.com",
      "is_email_verified": true,
      "is_active": true
    }
  },
  "timestamp": "2026-05-07T12:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```

| Field                    | Type      | Description                                |
| ------------------------ | --------- | ------------------------------------------ |
| `access_token`           | `string`  | JWT access token                           |
| `refresh_token`          | `string`  | JWT refresh token                          |
| `expires_in`             | `number`  | Access token TTL in seconds (default: 900) |
| `user.id`                | `string`  | User UUID                                  |
| `user.email`             | `string`  | User email address                         |
| `user.is_email_verified` | `boolean` | Whether email has been verified            |
| `user.is_active`         | `boolean` | Whether account is active                  |

---

## Error Codes

| Code                        | HTTP | Description                                |
| --------------------------- | ---- | ------------------------------------------ |
| `AUTH_EMAIL_ALREADY_EXISTS` | 409  | Email is already registered                |
| `AUTH_INVALID_CREDENTIALS`  | 401  | Wrong email or password                    |
| `AUTH_INVALID_TOKEN`        | 401  | Token is invalid, expired, or already used |
| `GENERIC_FORBIDDEN`         | 403  | Account is inactive                        |
| `GENERIC_UNAUTHORIZED`      | 401  | Missing or invalid access token            |
| `GENERIC_VALIDATION_ERROR`  | 422  | Request body failed validation             |
