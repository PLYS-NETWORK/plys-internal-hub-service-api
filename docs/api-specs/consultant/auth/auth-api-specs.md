# Consultant Auth API

Authentication endpoints for the Consultant platform. All routes live under the global prefix `/api/v1` and the controller is mounted on `/auth`.

**Base path:** `/api/v1/auth`
**`active_platform` value:** `consultant`

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

Error responses follow the same envelope with `error_code` populated and HTTP `status_code` matching the failure. `details` is present for errors that carry contextual data (e.g. `blocked_until`, `ban_reason`).

---

## Two consultant-specific account gates

The consultant platform layers two extra gates on top of the standard auth flow. Both share the same shape (HTTP 403 + `details`) but carry distinct `error_code` values so the client can render the right copy.

### 1. Time-boxed onboarding block — `CONSULTANT_ONBOARDING_BLOCKED`

After an admin **rejects** a consultant's onboarding (`POST /admin/onboardings/:id/decide` with `decision = REJECTED`):

1. The server records `consultant_onboardings.blocked_until = now + 3 months` on the rejected row.
2. The consultant receives a rejection email explaining the decision and the date the block lifts.
3. While `blocked_until > now`, the following endpoints return **`403 CONSULTANT_ONBOARDING_BLOCKED`** with `details.blocked_until` (ISO timestamp):
   - `POST /auth/register` (re-registration on the same email + platform)
   - `POST /auth/login` (email/password sign-in)
   - `POST /auth/sso/exchange` and `POST /auth/sso/google/token` (Google SSO sign-in)
4. `users.is_active` is **not** touched by a rejection — the block is time-boxed. Once `blocked_until` passes, every endpoint above returns to normal and the consultant may re-onboard.

```json
{
  "status_code": 403,
  "message": "Your account is blocked from onboarding until 2026-08-14T10:11:00.000Z. Please try again after that date.",
  "error_code": "CONSULTANT_ONBOARDING_BLOCKED",
  "data": null,
  "details": { "blocked_until": "2026-08-14T10:11:00.000Z" },
  "timestamp": "2026-05-17T10:11:00.000Z",
  "path": "/api/v1/auth/login"
}
```

### 2. Permanent ban — `AUTH_ACCOUNT_INACTIVE`

A separate, permanent ban path fires from skill-exam CopyLeaks abuse (3-strike lifetime counter). When the third strike lands:

1. `users.is_active = false`, `users.banned_at = now`, `users.ban_reason = 'AI_CONTENT_ABUSE'`.
2. **Every active `user_sessions` row for the user is deleted in the same transaction.** Cached JWTs are immediately useless — the next request hits the `is_active = false` gate.
3. The consultant gets a `consultant_account_banned` in-app notification; admin platform receives an `admin_consultant_banned` fan-out.

Subsequent calls to `POST /auth/login`, `POST /auth/sso/exchange`, `POST /auth/sso/google/token`, and any authenticated route return `403 AUTH_ACCOUNT_INACTIVE` with `details.ban_reason`:

```json
{
  "status_code": 403,
  "message": "Account is inactive",
  "error_code": "AUTH_ACCOUNT_INACTIVE",
  "data": null,
  "details": { "ban_reason": "AI_CONTENT_ABUSE" },
  "timestamp": "2026-05-17T10:11:00.000Z",
  "path": "/api/v1/auth/login"
}
```

---

## Throttling tiers

Every endpoint is rate-limited. Exceeding the limit returns HTTP `429 Too Many Requests` (`error_code: AUTH_RATE_LIMITED`).

| Tier          | Limit          | Applied to                                                           |
| ------------- | -------------- | -------------------------------------------------------------------- |
| `STRICT`      | 5 req / 60 s   | `register`, `login`, `change-password`                               |
| `MODERATE`    | 10 req / 60 s  | `verify-email`, `reset-password`, `sso/exchange`, `sso/google/token` |
| `INTERACTIVE` | 30 req / 60 s  | `refresh`                                                            |
| `OTP`         | 3 req / 60 min | `forgot-password`, `resend-verification`                             |
| `DEFAULT`     | 60 req / 60 s  | `logout`, `me`, `sso/google`, `sso/google/callback`                  |

---

## Endpoints

### POST /auth/register

Register a new consultant account. Sends a verification email on success. This endpoint is gated by the **BFF shared secret** (`x-api-key`) — direct browser calls are rejected.

#### Headers

| Header          | Required | Description                                         |
| --------------- | -------- | --------------------------------------------------- |
| `x-api-key`     | **Yes**  | BFF shared secret. Compared with `timingSafeEqual`. |
| `x-device-id`   | No       | Stable device identifier for session binding        |
| `x-fingerprint` | No       | Client fingerprint stored in the session record     |

#### Request body

```json
{
  "email": "jane@example.com",
  "password": "P@ssword123",
  "active_platform": "consultant",
  "full_name": "Jane Doe"
}
```

| Field             | Type     | Constraints                                                                                  |
| ----------------- | -------- | -------------------------------------------------------------------------------------------- |
| `email`           | `string` | Valid email address                                                                          |
| `password`        | `string` | Min 8 chars; must contain at least one uppercase letter, one lowercase letter, and one digit |
| `active_platform` | `string` | Must be `"consultant"` (admin self-registration is rejected)                                 |
| `full_name`       | `string` | Required when `active_platform` is `consultant`                                              |

#### Responses

**201 Created** — account created, verification email dispatched. `data` is `null`.

```json
{
  "status_code": 201,
  "message": "Created",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

**Error responses**

| HTTP | `error_code`                      | When                                                                                                                                                                                                             |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`            | Missing or invalid `x-api-key`                                                                                                                                                                                   |
| 409  | `AUTH_EMAIL_ALREADY_REGISTERED`   | Email is already registered **and verified** on this platform                                                                                                                                                    |
| 409  | `AUTH_EMAIL_PENDING_VERIFICATION` | Email exists but is unverified and a still-valid verification token is outstanding (user should check inbox); when the prior token has expired the server transparently issues a new one and returns 201 instead |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED`   | Prior admin rejection is still in force; body includes `details.blocked_until`                                                                                                                                   |
| 422  | `GENERIC_VALIDATION_FAILED`       | Body failed validation                                                                                                                                                                                           |
| 429  | `AUTH_RATE_LIMITED`               | STRICT throttle exceeded (5/60 s)                                                                                                                                                                                |

---

### POST /auth/verify-email

Verify email using the token from the verification link. Returns a fresh session on success — the consultant is signed in immediately.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request body

```json
{
  "token": "<verification-token>"
}
```

| Field   | Type     | Constraints                                          |
| ------- | -------- | ---------------------------------------------------- |
| `token` | `string` | Opaque verification token issued by `/auth/register` |

> The legacy `active_platform` field is no longer required — the platform is recovered from the user record bound to the token.

#### Responses

**200 OK** — email verified, session tokens returned. `data` is the [Auth Response](#auth-response) shape.

**Error responses**

| HTTP | `error_code`                | When                                      |
| ---- | --------------------------- | ----------------------------------------- |
| 400  | `AUTH_TOKEN_INVALID`        | Token not found (never issued / mistyped) |
| 400  | `AUTH_TOKEN_ALREADY_USED`   | Token was already consumed                |
| 400  | `AUTH_TOKEN_EXPIRED`        | Token is past its 24 h expiry             |
| 422  | `GENERIC_VALIDATION_FAILED` | Body failed validation                    |
| 429  | `AUTH_RATE_LIMITED`         | MODERATE throttle exceeded (10/60 s)      |

---

### POST /auth/resend-verification

Resend the email verification link. **Always returns 200** regardless of whether the account exists or is already verified — prevents user enumeration.

#### Request body

```json
{
  "email": "jane@example.com",
  "active_platform": "consultant"
}
```

| Field             | Type     | Constraints            |
| ----------------- | -------- | ---------------------- |
| `email`           | `string` | Valid email address    |
| `active_platform` | `string` | Must be `"consultant"` |

#### Responses

**200 OK** — verification email dispatched (or silently ignored when the account does not exist / is already verified).

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/auth/resend-verification"
}
```

**Error responses**

| HTTP | `error_code`                | When                                        |
| ---- | --------------------------- | ------------------------------------------- |
| 422  | `GENERIC_VALIDATION_FAILED` | Body failed validation                      |
| 429  | `AUTH_RATE_LIMITED`         | OTP throttle exceeded (3/hour per IP+email) |

---

### POST /auth/login

Authenticate with email and password.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request body

```json
{
  "email": "jane@example.com",
  "password": "P@ssword123",
  "active_platform": "consultant"
}
```

| Field             | Type     | Constraints            |
| ----------------- | -------- | ---------------------- |
| `email`           | `string` | Valid email address    |
| `password`        | `string` | Any non-empty string   |
| `active_platform` | `string` | Must be `"consultant"` |

#### Responses

**200 OK** — login successful. `data` is the [Auth Response](#auth-response) shape.

**Error responses**

| HTTP | `error_code`                    | When                                                                                                                          |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_INVALID_CREDENTIALS`      | Wrong email or password; or no password set on the account (e.g. SSO-only)                                                    |
| 403  | `AUTH_EMAIL_NOT_VERIFIED`       | Credentials valid but the email has not been verified; server best-effort re-issues a verification email                      |
| 403  | `AUTH_ACCOUNT_INACTIVE`         | Account permanently disabled — `details.ban_reason` is included                                                               |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED` | Admin rejected the consultant's onboarding and the 3-month block window is still active — `details.blocked_until` is included |
| 422  | `GENERIC_VALIDATION_FAILED`     | Body failed validation                                                                                                        |
| 429  | `AUTH_ACCOUNT_LOCKED`           | Too many recent failed login attempts on this account; counter rolls after the lockout window                                 |
| 429  | `AUTH_RATE_LIMITED`             | STRICT throttle exceeded (5/60 s)                                                                                             |

---

### POST /auth/refresh

Rotate the refresh token and issue a fresh access/refresh pair. Single-use: the supplied refresh token is invalidated on success, and detected reuse revokes every session for the user.

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

| Field           | Type     | Constraints                                                                                                 |
| --------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `refresh_token` | `string` | Refresh JWT issued by a previous `/auth/login`, `/auth/verify-email`, `/auth/refresh`, or SSO exchange call |

#### Responses

**200 OK** — new session tokens returned. `data` is the [Auth Response](#auth-response) shape.

**Error responses**

| HTTP | `error_code`                | When                                                                                |
| ---- | --------------------------- | ----------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`      | Refresh JWT signature invalid, missing, or expired (rejected at the Passport guard) |
| 401  | `AUTH_TOKEN_INVALID`        | JWT validates but no matching active session is found (already rotated / replay)    |
| 401  | `AUTH_TOKEN_EXPIRED`        | Session row exists but `expires_at` has passed                                      |
| 422  | `GENERIC_VALIDATION_FAILED` | Body failed validation                                                              |
| 429  | `AUTH_RATE_LIMITED`         | INTERACTIVE throttle exceeded (30/60 s)                                             |

> **Replay handling.** When the supplied refresh token matches a session whose `used_at` is already set, the server treats this as a replay attempt and revokes **all** sessions for that user before returning `AUTH_TOKEN_INVALID`. The user must sign in again on every device.

---

### POST /auth/logout

Revoke the current session. Requires `Authorization: Bearer <access_token>`.

#### Request body

_None._

#### Responses

**200 OK** — session revoked. `data` is `null`.

**Error responses**

| HTTP | `error_code`           | When                            |
| ---- | ---------------------- | ------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED` | Missing or invalid access token |

---

### GET /auth/me

Return the authenticated user's profile. Requires `Authorization: Bearer <access_token>`.

#### Responses

**200 OK** — `data` is a [User Response](#user-response).

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "jane@example.com",
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

### POST /auth/change-password

Change the authenticated user's password. Requires `Authorization: Bearer <access_token>`. All **other** sessions (every device except the current one) are revoked on success.

#### Request body

```json
{
  "current_password": "P@ssword123",
  "new_password": "NewP@ssword123"
}
```

| Field              | Type     | Constraints                                                            |
| ------------------ | -------- | ---------------------------------------------------------------------- |
| `current_password` | `string` | Any non-empty string                                                   |
| `new_password`     | `string` | Min 8 chars; must contain at least one uppercase, lowercase, and digit |

#### Responses

**200 OK** — password updated; current session is preserved, all others revoked.

**Error responses**

| HTTP | `error_code`                | When                                                                          |
| ---- | --------------------------- | ----------------------------------------------------------------------------- |
| 400  | `AUTH_INVALID_CREDENTIALS`  | `current_password` is incorrect or the account has no password set (SSO-only) |
| 401  | `GENERIC_UNAUTHORIZED`      | Missing or invalid access token                                               |
| 404  | `AUTH_USER_NOT_FOUND`       | User no longer exists or is inactive                                          |
| 422  | `GENERIC_VALIDATION_FAILED` | Body failed validation                                                        |
| 429  | `AUTH_RATE_LIMITED`         | STRICT throttle exceeded (5/60 s)                                             |

---

### POST /auth/forgot-password

Request a password-reset OTP. **Always returns 200** regardless of whether the account exists — prevents enumeration.

#### Request body

```json
{
  "email": "jane@example.com",
  "active_platform": "consultant"
}
```

| Field             | Type     | Constraints            |
| ----------------- | -------- | ---------------------- |
| `email`           | `string` | Valid email address    |
| `active_platform` | `string` | Must be `"consultant"` |

#### Responses

**200 OK** — reset OTP dispatched (or silently ignored when no account / SSO-only / inactive).

**Error responses**

| HTTP | `error_code`                | When                                        |
| ---- | --------------------------- | ------------------------------------------- |
| 422  | `GENERIC_VALIDATION_FAILED` | Body failed validation                      |
| 429  | `AUTH_RATE_LIMITED`         | OTP throttle exceeded (3/hour per IP+email) |

---

### POST /auth/reset-password

Reset the password using the 6-digit OTP delivered by email. **Revokes all existing sessions on success** — the user must sign in again on every device.

#### Request body

```json
{
  "email": "jane@example.com",
  "active_platform": "consultant",
  "otp": "391827",
  "new_password": "NewP@ssword123"
}
```

| Field             | Type     | Constraints                                                            |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| `email`           | `string` | Valid email address                                                    |
| `active_platform` | `string` | Must be `"consultant"`                                                 |
| `otp`             | `string` | Exactly 6 digits (`/^\d{6}$/`)                                         |
| `new_password`    | `string` | Min 8 chars; must contain at least one uppercase, lowercase, and digit |

#### Responses

**200 OK** — password reset; all sessions revoked.

**Error responses**

| HTTP | `error_code`                | When                                      |
| ---- | --------------------------- | ----------------------------------------- |
| 400  | `AUTH_RESET_TOKEN_INVALID`  | OTP unknown or no matching active account |
| 400  | `AUTH_TOKEN_ALREADY_USED`   | OTP was already consumed                  |
| 400  | `AUTH_RESET_TOKEN_EXPIRED`  | OTP is past its 15-minute window          |
| 422  | `GENERIC_VALIDATION_FAILED` | Body failed validation                    |
| 429  | `AUTH_RATE_LIMITED`         | MODERATE throttle exceeded (10/60 s)      |

---

### GET /auth/sso/google

Initiate the Google OAuth redirect flow. The server stores a CSRF-bound state nonce in Redis and forwards the browser to Google.

#### Query parameters

| Parameter         | Required | Description                                                                                                                              |
| ----------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `active_platform` | No       | `consultant` — recorded in the CSRF state record. Used by the callback to pick the right frontend host and platform when issuing tokens. |

#### Response

**302 Redirect** — forwards to the Google OAuth consent screen.

---

### GET /auth/sso/google/callback

Google OAuth callback. Validates the CSRF state nonce, runs `ssoLogin`, then **redirects the browser to the frontend** with a single-use exchange `code` (no tokens in the URL):

```
<LONA_URL>/auth/sso/callback?code=<single-use-exchange-code>
```

The frontend then POSTs the code to [`/auth/sso/exchange`](#post-authssoexchange) to receive tokens. The code is valid **once** for a short TTL (~60 seconds).

This endpoint is reached by the user-agent following a Google redirect, not called directly by clients. It can fail with `AUTH_OAUTH_STATE_INVALID` (400) if the CSRF state nonce is missing, malformed, or already consumed.

---

### POST /auth/sso/exchange

Exchange the single-use code returned by `/auth/sso/google/callback` for real session tokens.

#### Request body

```json
{
  "code": "BJfQg7..."
}
```

| Field  | Type     | Constraints                                                       |
| ------ | -------- | ----------------------------------------------------------------- |
| `code` | `string` | 16–128 characters; single-use code from the SSO callback redirect |

#### Responses

**200 OK** — session tokens returned. `data` is the [Auth Response](#auth-response) shape.

**Error responses**

| HTTP | `error_code`                    | When                                                                  |
| ---- | ------------------------------- | --------------------------------------------------------------------- |
| 401  | `AUTH_SSO_EXCHANGE_INVALID`     | Code is unknown, already consumed, or expired                         |
| 403  | `AUTH_ACCOUNT_INACTIVE`         | Account is permanently disabled — `details.ban_reason` included       |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED` | Admin rejection block still active — `details.blocked_until` included |
| 422  | `GENERIC_VALIDATION_FAILED`     | Body failed validation                                                |
| 429  | `AUTH_RATE_LIMITED`             | MODERATE throttle exceeded (10/60 s)                                  |

> The 403 errors here surface only when the underlying `ssoLogin` ran during the callback step but the exchange itself happens after the user has hit a blocked / inactive state — in practice the callback redirect already issued the code, so most exchange-time failures are 401.

---

### POST /auth/sso/google/token

Exchange a Google **ID token** (obtained client-side via the Google JS / native SDK) for platform session tokens. Used by SPAs and mobile clients that run the OAuth flow natively instead of using the server redirect.

#### Headers

| Header          | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `x-device-id`   | No       | Stable device identifier for session binding    |
| `x-fingerprint` | No       | Client fingerprint stored in the session record |

#### Request body

```json
{
  "id_token": "eyJhbGci...",
  "active_platform": "consultant"
}
```

| Field             | Type     | Constraints                                     |
| ----------------- | -------- | ----------------------------------------------- |
| `id_token`        | `string` | Google ID token from the client-side OAuth flow |
| `active_platform` | `string` | Must be `"consultant"`                          |

#### Responses

**200 OK** — session tokens returned. `data` is the [Auth Response](#auth-response) shape.

**Error responses**

| HTTP | `error_code`                    | When                                                                         |
| ---- | ------------------------------- | ---------------------------------------------------------------------------- |
| 401  | `AUTH_INVALID_CREDENTIALS`      | Google ID token failed verification (expired, wrong audience, missing email) |
| 403  | `AUTH_ACCOUNT_INACTIVE`         | Account is permanently disabled — `details.ban_reason` included              |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED` | Admin rejection block still active — `details.blocked_until` included        |
| 422  | `GENERIC_VALIDATION_FAILED`     | Body failed validation                                                       |
| 429  | `AUTH_RATE_LIMITED`             | MODERATE throttle exceeded (10/60 s)                                         |

---

## Auth Response

Shape of the `data` field for `/login`, `/verify-email`, `/refresh`, `/sso/exchange`, and `/sso/google/token`:

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
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/auth/login"
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

### User Response

Shape of the `data` field for `/me`, and the embedded `user` object inside `IAuthResponse`:

```ts
interface IUserResponse {
  id: string; // user UUID
  email: string; // user email
  is_email_verified: boolean;
  is_active: boolean;
}
```

| Field               | Type      | Description                                      |
| ------------------- | --------- | ------------------------------------------------ |
| `id`                | `string`  | User UUID                                        |
| `email`             | `string`  | User email address                               |
| `is_email_verified` | `boolean` | Whether the email has been verified              |
| `is_active`         | `boolean` | `false` when the account is permanently disabled |

---

## Error code reference

| `error_code`                      | HTTP      | Where it fires                                                                                                                       |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GENERIC_UNAUTHORIZED`            | 401       | Missing/invalid access JWT, missing/invalid `x-api-key`, or refresh JWT failed Passport verification                                 |
| `GENERIC_VALIDATION_FAILED`       | 422       | DTO validation failure (class-validator)                                                                                             |
| `AUTH_INVALID_CREDENTIALS`        | 401 / 400 | Wrong password (login: 401), invalid current password (change-password: 400), or Google ID-token rejected (sso/google/token: 401)    |
| `AUTH_EMAIL_NOT_VERIFIED`         | 403       | Credentials valid but email is unverified; server best-effort re-issues a verification email                                         |
| `AUTH_EMAIL_ALREADY_REGISTERED`   | 409       | Register attempt against an existing **verified** account on this platform                                                           |
| `AUTH_EMAIL_PENDING_VERIFICATION` | 409       | Register attempt against an existing unverified account whose verification token is still valid                                      |
| `AUTH_ACCOUNT_INACTIVE`           | 403       | Account permanently disabled (`users.is_active = false`); `details.ban_reason` included                                              |
| `AUTH_ACCOUNT_LOCKED`             | 429       | Too many recent failed login attempts; counter rolls automatically after the lockout window                                          |
| `AUTH_TOKEN_INVALID`              | 400 / 401 | Verification token not found (verify-email: 400) or no matching active session for the refresh JWT (refresh: 401)                    |
| `AUTH_TOKEN_EXPIRED`              | 400 / 401 | Verification token expired (verify-email: 400) or session expired (refresh: 401)                                                     |
| `AUTH_TOKEN_ALREADY_USED`         | 400       | Verification token or OTP was already consumed                                                                                       |
| `AUTH_RESET_TOKEN_INVALID`        | 400       | Password-reset OTP unknown or no matching account                                                                                    |
| `AUTH_RESET_TOKEN_EXPIRED`        | 400       | Password-reset OTP past its 15-minute window                                                                                         |
| `AUTH_SSO_EXCHANGE_INVALID`       | 401       | SSO exchange code unknown, consumed, or expired                                                                                      |
| `AUTH_OAUTH_STATE_INVALID`        | 400       | CSRF state nonce missing/consumed during Google OAuth callback                                                                       |
| `AUTH_USER_NOT_FOUND`             | 404       | Authenticated user no longer exists or is inactive (raised by `/me`, `/change-password`)                                             |
| `AUTH_RATE_LIMITED`               | 429       | Endpoint throttle exceeded (per-IP/email)                                                                                            |
| `CONSULTANT_ONBOARDING_BLOCKED`   | 403       | Admin rejected the consultant's onboarding and the 3-month block window is still active; `details.blocked_until` is an ISO timestamp |
