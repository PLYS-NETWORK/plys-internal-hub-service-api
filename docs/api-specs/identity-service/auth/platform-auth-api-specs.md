# Platform Auth API — Business & Consultant

> HTTP edge owner: `apps/api-gateway/src/http/v1/identity/auth.controller.ts`
> Identity-service owns auth/session domain logic behind gRPC operations.

Email/password and Google SSO authentication for the **business** and **consultant** platforms. All routes live under `/api/v1/auth`.

After sign-in, session lifecycle uses the shared endpoints in [`auth-api-specs.md`](./auth-api-specs.md) (`/auth/refresh`, `/auth/logout`, `/auth/me`).

| Platform   | `active_platform` value |
| ---------- | ----------------------- |
| Business   | `business`              |
| Consultant | `consultant`            |

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

> **Consultant-only account gates** (onboarding rejection block, CopyLeaks ban) are documented in [`consultant-account-gates-api-specs.md`](./consultant-account-gates-api-specs.md).

---

## Throttling tiers

Every endpoint is rate-limited. Exceeding the limit returns HTTP `429 Too Many Requests` (`error_code: AUTH_RATE_LIMITED`).

| Tier          | Limit          | Applied to                                                           |
| ------------- | -------------- | -------------------------------------------------------------------- |
| `STRICT`      | 5 req / 60 s   | `register`, `login`, `change-password`                               |
| `MODERATE`    | 10 req / 60 s  | `verify-email`, `reset-password`, `sso/exchange`, `sso/google/token` |
| `INTERACTIVE` | 30 req / 60 s  | `refresh` (see [`auth-api-specs.md`](./auth-api-specs.md))           |
| `OTP`         | 3 req / 60 min | `forgot-password`, `resend-verification`                             |
| `DEFAULT`     | 60 req / 60 s  | `logout`, `me`, `sso/google`, `sso/google/callback`                  |

---

## Endpoints

### POST /auth/register

Register a new account. Sends a verification email on success. Gated by the **BFF shared secret** (`x-api-key`) — direct browser calls are rejected.

#### Headers

| Header          | Required | Description                                         |
| --------------- | -------- | --------------------------------------------------- |
| `x-api-key`     | **Yes**  | BFF shared secret. Compared with `timingSafeEqual`. |
| `x-device-id`   | No       | Stable device identifier for session binding        |
| `x-fingerprint` | No       | Client fingerprint stored in the session record     |

#### Request body

**Business example:**

```json
{
  "email": "owner@acme.com",
  "password": "P@ssword123",
  "active_platform": "business",
  "company_name": "Acme Inc.",
  "full_name": "John Owner"
}
```

**Consultant example:**

```json
{
  "email": "jane@example.com",
  "password": "P@ssword123",
  "active_platform": "consultant",
  "full_name": "Jane Doe"
}
```

| Field             | Type     | Constraints                                                                                                  |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `email`           | `string` | Valid email address                                                                                          |
| `password`        | `string` | Min 8 chars; must contain at least one uppercase letter, one lowercase letter, and one digit                 |
| `active_platform` | `string` | `"business"` or `"consultant"` (admin self-registration is rejected)                                         |
| `company_name`    | `string` | **Business only** — required when `active_platform` is `business`                                            |
| `full_name`       | `string` | Required for both platforms; for business, stored as the owner's name on the initial `business_profiles` row |

#### Responses

**201 Created** — account created, verification email dispatched. `data` is `null`.

**Error responses**

| HTTP | `error_code`                      | When                                                                                                                                                                                   |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`            | Missing or invalid `x-api-key`                                                                                                                                                         |
| 409  | `AUTH_EMAIL_ALREADY_REGISTERED`   | Email is already registered **and verified** on this platform                                                                                                                          |
| 409  | `AUTH_EMAIL_PENDING_VERIFICATION` | Email exists but is unverified and a still-valid verification token is outstanding; when the prior token has expired the server transparently issues a new one and returns 201 instead |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED`   | **Consultant only** — prior admin rejection is still in force; `details.blocked_until` included                                                                                        |
| 422  | `GENERIC_VALIDATION_FAILED`       | Body failed validation                                                                                                                                                                 |
| 429  | `AUTH_RATE_LIMITED`               | STRICT throttle exceeded (5/60 s)                                                                                                                                                      |

---

### POST /auth/verify-email

Verify email using the token from the verification link. Returns a fresh session on success — the user is signed in immediately.

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

**200 OK** — email verified, session tokens returned. `data` is the [Auth Response](./auth-api-specs.md#auth-response) shape.

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
  "email": "user@example.com",
  "active_platform": "business"
}
```

| Field             | Type     | Constraints                    |
| ----------------- | -------- | ------------------------------ |
| `email`           | `string` | Valid email address            |
| `active_platform` | `string` | `"business"` or `"consultant"` |

#### Responses

**200 OK** — verification email dispatched (or silently ignored when the account does not exist / is already verified). `data` is `null`.

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
  "email": "user@example.com",
  "password": "P@ssword123",
  "active_platform": "business"
}
```

| Field             | Type     | Constraints                    |
| ----------------- | -------- | ------------------------------ |
| `email`           | `string` | Valid email address            |
| `password`        | `string` | Any non-empty string           |
| `active_platform` | `string` | `"business"` or `"consultant"` |

#### Responses

**200 OK** — login successful. `data` is the [Auth Response](./auth-api-specs.md#auth-response) shape.

> **Business note:** the access JWT additionally carries `business_id` (the user's `business_profiles.id`) for fast business-scoped request context.

**Error responses**

| HTTP | `error_code`                    | When                                                                                                     |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_INVALID_CREDENTIALS`      | Wrong email or password; or no password set on the account (e.g. SSO-only)                               |
| 403  | `AUTH_EMAIL_NOT_VERIFIED`       | Credentials valid but the email has not been verified; server best-effort re-issues a verification email |
| 403  | `AUTH_ACCOUNT_INACTIVE`         | Account disabled (`users.is_active = false`); `details.ban_reason` included when set                     |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED` | **Consultant only** — admin rejection block still active; `details.blocked_until` included               |
| 422  | `GENERIC_VALIDATION_FAILED`     | Body failed validation                                                                                   |
| 429  | `AUTH_ACCOUNT_LOCKED`           | Too many recent failed login attempts; counter rolls after the lockout window                            |
| 429  | `AUTH_RATE_LIMITED`             | STRICT throttle exceeded (5/60 s)                                                                        |

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
  "email": "user@example.com",
  "active_platform": "business"
}
```

| Field             | Type     | Constraints                    |
| ----------------- | -------- | ------------------------------ |
| `email`           | `string` | Valid email address            |
| `active_platform` | `string` | `"business"` or `"consultant"` |

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
  "email": "user@example.com",
  "active_platform": "business",
  "otp": "483920",
  "new_password": "NewP@ssword123"
}
```

| Field             | Type     | Constraints                                                            |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| `email`           | `string` | Valid email address                                                    |
| `active_platform` | `string` | `"business"` or `"consultant"`                                         |
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

| Parameter         | Required | Description                                                                                             |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `active_platform` | No       | `business` or `consultant` — recorded in the CSRF state record for callback routing and token issuance. |

#### Response

**302 Redirect** — forwards to the Google OAuth consent screen.

---

### GET /auth/sso/google/callback

Google OAuth callback. Validates the CSRF state nonce, runs `ssoLogin`, then **redirects the browser to the frontend** with a single-use exchange `code` (no tokens in the URL):

```
<PLOYOS_URL or LONAOS_URL>/auth/sso/callback?code=<single-use-exchange-code>
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

**200 OK** — session tokens returned. `data` is the [Auth Response](./auth-api-specs.md#auth-response) shape.

**Error responses**

| HTTP | `error_code`                    | When                                                         |
| ---- | ------------------------------- | ------------------------------------------------------------ |
| 401  | `AUTH_SSO_EXCHANGE_INVALID`     | Code is unknown, already consumed, or expired                |
| 403  | `AUTH_ACCOUNT_INACTIVE`         | Account is disabled — `details.ban_reason` included when set |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED` | **Consultant only** — admin rejection block still active     |
| 422  | `GENERIC_VALIDATION_FAILED`     | Body failed validation                                       |
| 429  | `AUTH_RATE_LIMITED`             | MODERATE throttle exceeded (10/60 s)                         |

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
  "active_platform": "business"
}
```

| Field             | Type     | Constraints                                     |
| ----------------- | -------- | ----------------------------------------------- |
| `id_token`        | `string` | Google ID token from the client-side OAuth flow |
| `active_platform` | `string` | `"business"` or `"consultant"`                  |

#### Responses

**200 OK** — session tokens returned. `data` is the [Auth Response](./auth-api-specs.md#auth-response) shape.

**Error responses**

| HTTP | `error_code`                    | When                                                                         |
| ---- | ------------------------------- | ---------------------------------------------------------------------------- |
| 401  | `AUTH_INVALID_CREDENTIALS`      | Google ID token failed verification (expired, wrong audience, missing email) |
| 403  | `AUTH_ACCOUNT_INACTIVE`         | Account is disabled — `details.ban_reason` included when set                 |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED` | **Consultant only** — admin rejection block still active                     |
| 422  | `GENERIC_VALIDATION_FAILED`     | Body failed validation                                                       |
| 429  | `AUTH_RATE_LIMITED`             | MODERATE throttle exceeded (10/60 s)                                         |

---

## Error code reference

| `error_code`                      | HTTP      | Where it fires                                                                                                                    |
| --------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GENERIC_UNAUTHORIZED`            | 401       | Missing/invalid `x-api-key`, or missing/invalid access JWT on authenticated routes                                                |
| `GENERIC_VALIDATION_FAILED`       | 422       | DTO validation failure (class-validator)                                                                                          |
| `AUTH_INVALID_CREDENTIALS`        | 401 / 400 | Wrong password (login: 401), invalid current password (change-password: 400), or Google ID-token rejected (sso/google/token: 401) |
| `AUTH_EMAIL_NOT_VERIFIED`         | 403       | Credentials valid but email is unverified; server best-effort re-issues a verification email                                      |
| `AUTH_EMAIL_ALREADY_REGISTERED`   | 409       | Register attempt against an existing **verified** account on this platform                                                        |
| `AUTH_EMAIL_PENDING_VERIFICATION` | 409       | Register attempt against an existing unverified account whose verification token is still valid                                   |
| `AUTH_ACCOUNT_INACTIVE`           | 403       | Account disabled (`users.is_active = false`); `details.ban_reason` included when set                                              |
| `AUTH_ACCOUNT_LOCKED`             | 429       | Too many recent failed login attempts; counter rolls automatically after the lockout window                                       |
| `AUTH_TOKEN_INVALID`              | 400       | Verification token not found (verify-email)                                                                                       |
| `AUTH_TOKEN_EXPIRED`              | 400       | Verification token expired (verify-email)                                                                                         |
| `AUTH_TOKEN_ALREADY_USED`         | 400       | Verification token or OTP was already consumed                                                                                    |
| `AUTH_RESET_TOKEN_INVALID`        | 400       | Password-reset OTP unknown or no matching account                                                                                 |
| `AUTH_RESET_TOKEN_EXPIRED`        | 400       | Password-reset OTP past its 15-minute window                                                                                      |
| `AUTH_SSO_EXCHANGE_INVALID`       | 401       | SSO exchange code unknown, consumed, or expired                                                                                   |
| `AUTH_OAUTH_STATE_INVALID`        | 400       | CSRF state nonce missing/consumed during Google OAuth callback                                                                    |
| `AUTH_USER_NOT_FOUND`             | 404       | Authenticated user no longer exists or is inactive (raised by `/change-password`)                                                 |
| `AUTH_RATE_LIMITED`               | 429       | Endpoint throttle exceeded (per-IP/email)                                                                                         |
| `CONSULTANT_ONBOARDING_BLOCKED`   | 403       | **Consultant only** — see [`consultant-account-gates-api-specs.md`](./consultant-account-gates-api-specs.md)                      |

Shared session error codes for `/auth/refresh`, `/auth/logout`, and `/auth/me` are in [`auth-api-specs.md`](./auth-api-specs.md#error-code-reference).

---

## Cross-links

- **Consultant account gates:** [`consultant-account-gates-api-specs.md`](./consultant-account-gates-api-specs.md)
- **Shared session lifecycle:** [`auth-api-specs.md`](./auth-api-specs.md)
- **Admin OTP login:** [`admin-auth-api-specs.md`](./admin-auth-api-specs.md)
