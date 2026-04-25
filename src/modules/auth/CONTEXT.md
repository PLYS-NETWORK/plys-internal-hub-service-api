# Auth & Identity — Business Context

## Purpose
Owns every identity row and credential/session that authenticates it. A single human may hold up to **three independent accounts** — one per platform (`business`, `consultant`, `admin`) — each with its own email/password and its own profile. This module never joins those accounts together.

## Tables owned
- `users` — identity rows, **one per (email, platform)**. The `platform` column is immutable; email uniqueness is enforced per-platform via a functional unique index on `(platform, LOWER(email))`.
- `auth_tokens` — short-lived tokens for email verification, password reset, and magic links. Tokens are stored as SHA-256 hashes; the raw token is only ever sent via email. Each token is scoped to a single `user_id` and therefore a single platform.
- `user_sso_providers` — OAuth/SSO links (Google, LinkedIn, GitHub). Uniqueness is `(platform, provider, provider_user_id)` so the same Google account may independently link to a Business user and a Consultant user. **`access_token` / `refresh_token` are encrypted at rest** via AES-256-GCM (`v1:<iv>:<tag>:<ct>` envelope) — the column transformer in [encrypted-string.transformer.ts](../../database/transformers/encrypted-string.transformer.ts) handles encrypt-on-write / decrypt-on-read.
- `user_sessions` — active login sessions. The owning user's platform is read from `users.platform`; no denormalized copy lives on the session row. Each device creates a separate session. Columns include `device_id` (client-generated UUID for session binding), `fingerprint` (client-side hash for future risk scoring), and **`used_at`** (single-use marker for refresh-token rotation; non-null indicates the row has been consumed).

## Endpoints

| Method | Path | Auth | Throttle | Description |
|--------|------|------|----------|-------------|
| POST | `/auth/register` | `@Public` | 5 / min / IP+email | Register with email/password → sends verification email |
| POST | `/auth/verify-email` | `@Public` | 10 / min / IP | Verify email with token → sends welcome email |
| POST | `/auth/resend-verification` | `@Public` | 3 / min / IP | Re-send verification email (silent on unknown / already-verified) |
| POST | `/auth/login` | `@Public` | 5 / min / IP+email | Login with email/password, requires verified email |
| POST | `/auth/forgot-password` | `@Public` | 3 / hour / IP+email | Send 6-digit OTP to email (silent on unknown account) |
| POST | `/auth/reset-password` | `@Public` | 10 / min / IP+email | Consume OTP, set new password, revoke all sessions |
| POST | `/auth/refresh` | `@Public` + `RefreshTokenGuard` | 30 / min / IP | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | `@JwtAuthGuard` | 60 / min / IP (default) | Revoke current session (hard delete) |
| GET | `/auth/me` | `@JwtAuthGuard` | 60 / min / IP (default) | Get current user profile |
| POST | `/auth/change-password` | `@JwtAuthGuard` | 60 / min / IP (default) | Change password → revokes all other sessions |
| GET | `/auth/sso/google` | `@Public` | 60 / min / IP (default) | Initiate Google OAuth redirect — issues CSRF state nonce |
| GET | `/auth/sso/google/callback` | `@Public` + `GoogleCallbackGuard` | 60 / min / IP (default) | Validate state, redirect with single-use exchange `code` (NO tokens in URL) |
| POST | `/auth/sso/exchange` | `@Public` | 10 / min / IP+code | Exchange single-use SSO code for access/refresh tokens |
| POST | `/auth/sso/google/token` | `@Public` | 10 / min / IP | Exchange Google ID token for platform tokens (SPA/mobile) |

## Authentication flows

### Email/Password Registration
Self-registration is permitted only for `business` and `consultant` — admins are provisioned out-of-band. Payload is shape-dependent on `active_platform`:

| `active_platform` | Required extra field | Profile row created |
|---|---|---|
| `business`   | `company_name` | `business_profiles` (companyName, isVerified=false) |
| `consultant` | `full_name`    | `consultant_profiles` (fullName, isVerified=false) |
| `admin`      | — (rejected — 403) | n/a |

1. DTO-level validation: `@IsIn([business, consultant])` and `@ValidateIf` enforces the right name field per platform.
2. Uniqueness check: `findUserByEmailAndPlatform(email, active_platform)` — 409 on duplicate. The same email may register on a different platform.
3. Password hashed with bcrypt (12 rounds).
4. **In one transaction**: `User` row (platform-bound, `isEmailVerified: false`) + matching profile row (name field only; rest filled via profile module) + `AuthToken(EMAIL_VERIFICATION)` (SHA-256 of raw 32-byte token).
5. Verification email sent **awaited** inside the transaction — delivery failure rolls back the user row so the caller can retry cleanly.
6. Verification URL: `FRONTEND_URL/verify-email?token=<raw>`, expires in 24 hours.

### Email Verification
1. Client submits raw token.
2. SHA-256 → lookup in `auth_tokens` by `tokenHash` + type `EMAIL_VERIFICATION`.
3. Validate: not already used (`usedAt`), not expired (`expiresAt`).
4. Transaction: mark `usedAt`, set `user.isEmailVerified = true`, `emailVerifiedAt = now`.
5. Welcome email sent (fire-and-forget).

### Email/Password Login
Accepts `{ email, password, active_platform }` — same endpoint for all three platforms including admin.
1. Find user by `(LOWER(email), active_platform)` — returns generic "invalid credentials" if not found (prevents enumeration).
2. Check: `isActive`, `passwordHash` exists (not SSO-only).
3. **Lockout check** (`LoginAttemptTracker.assertNotLocked`): if `LOGIN_LOCKOUT_THRESHOLD` failures have accumulated for this user inside the rolling window → throw `AUTH_ACCOUNT_LOCKED` (429) **before** the bcrypt compare so the response is fast.
4. bcrypt compare. **On failure**: `recordFailure(userId)` increments the Redis counter (TTL = `LOGIN_LOCKOUT_WINDOW_MIN`), throws generic `AUTH_INVALID_CREDENTIALS`. **On success**: `reset(userId)` clears the counter immediately.
5. Check `isEmailVerified`.
6. Update `lastLoginAt`.
7. `createSession()` → returns `{ access_token, refresh_token, expires_in, user }`.

### Forgot Password
1. `POST /auth/forgot-password` with `{ email, active_platform }`.
2. Find user; if missing, inactive, or SSO-only → silent no-op (still returns 200) so callers cannot enumerate registered emails.
3. Generate 6-digit numeric OTP, SHA-256-hashed in `auth_tokens(type=PASSWORD_RESET)`, expires in 15 minutes.
4. Email the raw OTP via `EmailService.sendForgotPasswordOtpEmail` (awaited inside the transaction — delivery failure rolls back the token row).
5. Throttling — `3 requests / hour / IP+email` — combined with the Redis-backed `AuthThrottlerGuard` keys on `path:email:ip` so a single IP can't burn another user's quota.

### Reset Password
1. `POST /auth/reset-password` with `{ email, active_platform, otp, new_password }`.
2. Find user; if missing or inactive → throw `AUTH_RESET_TOKEN_INVALID` (generic, no enumeration).
3. SHA-256 the OTP, look up `(userId, tokenHash, type=PASSWORD_RESET)`. Reject if not found / used / expired.
4. **Transaction**: mark `usedAt`, hash new password (bcrypt 12 rounds), **revoke every session for the user** (`DELETE FROM user_sessions WHERE user_id = ?`).
5. With 1M OTP space + 10 attempts/min + 15-min window, brute-force probability is ≤ 150/1_000_000 = 0.015%.

### Session Creation (`createSession`)
1. Raw refresh token = `randomBytes(48).base64url()`, stored as SHA-256 hex in `user_sessions.session_token`. `used_at` is NULL on insert.
2. Session row includes: `userId`, `deviceId`, `fingerprint`, `ipAddress`, `userAgent`, `expiresAt`, `usedAt: null`. Platform is **not** stored on the session — it is read from `user.platform` whenever needed.
3. JWT payload: `{ sub, email, role, activePlatform, sessionId, deviceId, iss, aud }`.
4. Access token signed with `JWT_ACCESS_SECRET`, **algorithm pinned to HS256**, `iss=JWT_ISSUER`, `aud=JWT_AUDIENCE`, expiry from `JWT_ACCESS_EXPIRATION` (default 15m).
5. Response projected through `AuthResponseDto` → `UserResponseDto` (snake_case via `@Expose`).

### Token Refresh — atomic single-use rotation
1. Client sends `{ refresh_token }` in body (snake_case; Passport extracts from `refresh_token` field).
2. SHA-256 → call `findActiveByTokenForUpdate(tokenHash)` inside `uow.withTransaction`. The query is `WHERE session_token = ? AND used_at IS NULL` with `setLock('pessimistic_write')`.
3. **Reuse detection**: if the active lookup misses, fall back to `findByToken(tokenHash)`:
   - Hit AND `used_at IS NOT NULL` → **token reuse**: revoke every session for that user (`DELETE WHERE user_id = ?`), log `error: refresh — token reuse detected`, throw `AUTH_TOKEN_INVALID`.
   - Miss → throw `AUTH_TOKEN_INVALID` (token never existed).
4. If the row is expired → delete it, throw `AUTH_TOKEN_EXPIRED`.
5. Stamp `used_at = now()`, save. The lock guarantees a concurrent caller sees `used_at IS NOT NULL` and is rejected.
6. Outside the transaction, call `createSession()` for the user — fresh JWT, fresh refresh token.

### Logout
1. Hard-delete `UserSession` row by `sessionId` from JWT.
2. Note: the access token (15m TTL) remains valid until expiry. A Redis blacklist can be added later for stricter requirements.

### Change Password
1. Validate current password via bcrypt compare.
2. Transaction: update `passwordHash` (bcrypt 12 rounds), delete all `UserSession` rows for this user **except** the current session.
3. All other devices are forced to re-login.

### Google SSO — Web Redirect Flow (with CSRF state + code exchange)
1. `GET /auth/sso/google?active_platform=business` → `GoogleOAuthGuard.canActivate`:
   - Resolves `active_platform` (defaults to `business`).
   - **Issues a 32-byte random `nonce`** and persists `{ activePlatform }` in Redis under `sso:oauth-state:<nonce>` with a 10-minute TTL.
   - Stashes the nonce on the request so `getAuthenticateOptions` returns `{ state: nonce }` to Passport.
   - Passport redirects to Google's consent screen (scope: `email`, `profile`).
2. `GET /auth/sso/google/callback?code=…&state=<nonce>` → `GoogleCallbackGuard` exchanges the auth code; `GoogleStrategy.validate()` returns a normalized `GoogleProfile`.
3. **State validation**: `OAuthStateStore.consume(nonce)` does an atomic GET+DEL. Missing → `AUTH_OAUTH_STATE_INVALID` (CSRF / replay). The stored `activePlatform` is used as the source of truth (the URL is **not** trusted past this point).
4. `ssoLogin()` handles user upsert (see below) and returns an `AuthResponseDto`.
5. **Code exchange (no tokens in URL)**: `SsoCodeStore.issue(authResponse)` writes `{ access_token, refresh_token, ... }` to Redis under `sso:exchange:<code>` with TTL `SSO_EXCHANGE_CODE_TTL` (default 60s) and returns a 32-byte base64url code. The redirect URL is `<frontend>/auth/sso/callback?code=<code>` — never a token.
6. Frontend reads the `code` query param and `POST /auth/sso/exchange { code }`. The store does a single GET+DEL (`SsoCodeStore.consume`) and returns the tokens. Second exchange of the same code → `AUTH_SSO_EXCHANGE_INVALID` (401).

### Google SSO — Token Exchange Flow (SPA/Mobile)
1. Client handles Google sign-in popup/redirect and obtains a Google ID token.
2. `POST /auth/sso/google/token` with `{ id_token, active_platform }`.
3. **Hardened ID-token validation** (`GoogleSsoProvider.verifyToken`):
   - `OAuth2Client.verifyIdToken({ idToken, audience: googleClientId })` (signature + audience).
   - Defence in depth on the resolved payload: `iss` ∈ `{https://accounts.google.com, accounts.google.com}`, `email_verified === true`, `exp * 1000 ≥ Date.now()`, `email` present.
   - Any failure → `AUTH_TOKEN_INVALID`.
4. `ssoLogin()` handles user upsert.
5. Returns `AuthResponseDto` in standard response envelope.

### SSO User Upsert Logic (`ssoLogin`)
SSO is allowed only for `business` and `consultant`. `admin` SSO is rejected with `403`.
1. Lookup `UserSsoProvider` by `(platform, provider, providerUserId)` — the identity is platform-scoped.
2. **If linked**: validate `user.isActive` → refresh SSO tokens (encrypted at rest by the column transformer) → `createSession()` for that platform.
3. **If not linked** (inside a transaction):
   - Lookup user by `(email, active_platform)`.
   - **Exists**: auto-verify email if needed (SSO confirms ownership), bump `lastLoginAt`.
   - **Not found**: create new platform-bound `User` (`isEmailVerified: true`, `passwordHash: null`) **plus** the matching profile row seeded with the SSO `displayName`. Send welcome email.
4. Create `UserSsoProvider` row with the current `platform`, linking the provider identity.
5. `createSession()` for the target platform.

## JWT payload structure
```typescript
interface JwtPayload {
  sub: string;           // user.id (UUID) — scoped to (email, platform)
  email: string;
  role: UserRole;
  activePlatform: ActivePlatform; // 'business' | 'consultant' | 'admin'
  sessionId: string;     // user_sessions.id — for precise logout/refresh
  deviceId: string | null;
  iss?: string;          // = JWT_ISSUER on every newly signed token
  aud?: string;          // = JWT_AUDIENCE on every newly signed token
  iat?: number;
  exp?: number;
}
```

### Verification rules
- **Algorithm pinned**: middleware + strategy both pass `algorithms: ['HS256']` to reject alg-confusion (e.g. an asymmetric public key being used to verify symmetric signatures, or `alg: none`).
- **iss / aud**:
  - When `JWT_STRICT_CLAIMS=true` — both claims are required and must match `JWT_ISSUER` / `JWT_AUDIENCE`. Missing claims → `AUTH_TOKEN_INVALID`.
  - When `JWT_STRICT_CLAIMS=false` — claims are optional, but **if present they must match**. This is a roll-forward window so tokens issued by the previous deploy keep working for one access-token TTL. Flip to `true` once that window has elapsed.

## Guards & decorators

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` (global) | Validates access token. Skipped on `@Public()` routes. |
| `RolesGuard` (global) | Checks `@Roles()` metadata against `RequestContextService.userRole`. |
| `PlatformGuard` (global) | Checks `@Platform()` metadata against `RequestContextService.activePlatform`. |
| `AuthThrottlerGuard` (global, registered by AuthModule) | Composite-key throttler — keys on `<path>:<email\|code>:<ip>` for credential-bearing routes; IP-only elsewhere. |
| `RefreshTokenGuard` | Validates refresh-token Passport strategy from body field `refresh_token`. |
| `GoogleOAuthGuard` | Issues OAuth state nonce, redirects to Google. |
| `GoogleCallbackGuard` | Handles Google OAuth callback. |

- `@Public()` — skips `JwtAuthGuard`.
- `@Platform(ActivePlatform.BUSINESS)` — restricts endpoint to business platform users.
- `@Throttle({ default: { limit, ttl } })` — overrides the global 60/min default for a route.

## Rate limiting & lockout

Two layers, complementary:

| Layer | Where | Keyed by | What it stops |
|-------|-------|----------|---------------|
| **Per-IP / per-user-email throttle** | `AuthThrottlerGuard` + `@Throttle()` | `<path>:<email>:<ip>` (auth routes) or `<ip>` (default) | Burst attacks, password spraying, OTP brute-forcing, OAuth code replay floods |
| **Per-user account lockout** | `LoginAttemptTracker` (Redis counter) | `userId` | Distributed brute-force across IP pools — counter is cross-IP, so an attacker rotating proxies still escalates |

**Why both?** A pure IP-throttle is defeated by residential proxy pools. A pure per-user counter lets an attacker DoS a victim by intentionally tripping the lockout. Combining both means: legitimate users see at most a 15-minute lockout after 10 failures, but distributed attackers can't bypass the counter by rotating IPs.

The lockout counter resets on a successful credential check, so a user who recovers their password (or finally types it correctly) isn't penalised by older failures.

## Device binding & fingerprinting
- **`X-Device-ID` header**: client-generated UUID sent on every request. Stored in JWT `deviceId` and `user_sessions.device_id`. `JwtStrategy` and `JwtContextMiddleware` both validate that the header matches the JWT claim — mismatch triggers `401 Device mismatch`. **Opt-in**: clients that don't send the header skip the binding check.
- **`X-Fingerprint` header**: client-side fingerprint library hash. Stored in `user_sessions.fingerprint` for future anomaly detection / risk scoring. Not currently validated.

## Encryption at rest

| Column | Algorithm | Envelope | Key source |
|--------|-----------|----------|------------|
| `user_sso_providers.access_token` | AES-256-GCM | `v1:<iv_b64url>:<tag_b64url>:<ct_b64url>` | `SSO_TOKEN_ENCRYPTION_KEY` (base64-encoded 32 bytes) |
| `user_sso_providers.refresh_token` | AES-256-GCM | same | same |

Implementation: [`crypto-vault.ts`](../../common/utils/crypto-vault.ts) wraps Node's `createCipheriv('aes-256-gcm', …)` with a versioned envelope. The TypeORM `EncryptedStringTransformer` calls into it on every read/write so service-layer code keeps working with plaintext. Legacy plaintext rows (no `v1:` prefix) pass through `from()` unchanged so a one-time backfill can run online without a service interruption.

**Rotation** requires generating a new key, deploying with both keys readable, re-writing every encrypted row, then retiring the old key. Plan for one access-token TTL of overlap.

## Key invariants
- **Email uniqueness is per-platform and case-insensitive.** Enforced at the DB via a functional unique index on `(platform, LOWER(email))`. The same email may therefore exist at most three times (business, consultant, admin) as three independent accounts.
- **`users.platform` is immutable.** An identity never moves between platforms; a user who wants both sides registers twice.
- **`password_hash` is nullable** — SSO-only accounts never have one.
- **Token hashes never decode.** `auth_tokens.token_hash` stores SHA-256 of the raw token; the server rehashes the submitted value to compare.
- **SSO provider tokens are encrypted at rest.** `user_sso_providers.access_token` / `refresh_token` are AES-256-GCM envelopes; the column transformer is the single point of crypto.
- **SSO identity is platform-scoped.** `(platform, provider, provider_user_id)` is unique, so the same Google account can link to a Business and a Consultant user independently. SSO is rejected for `admin`.
- **Refresh-token rotation is single-use and atomic.** A row's `used_at` is stamped under a `pessimistic_write` lock; concurrent refresh of the same token cannot succeed twice. Replay of an already-used token revokes **every** session for the impacted user.
- **OAuth `state` is server-issued and single-use.** The callback never trusts the URL for `activePlatform`; it reads the value out of the Redis-stored state record bound to the nonce.
- **SSO callback never carries tokens in the URL.** Only a single-use exchange `code`. Tokens are returned by `POST /auth/sso/exchange` and the code is invalidated atomically (`GET` + `DEL`).
- **JWT algorithm is pinned to HS256.** Both middleware and strategy reject any other algorithm, eliminating alg-confusion attacks.
- **Admin accounts are not self-registered.** `POST /auth/register` rejects `active_platform: admin` with 403. Admins are created via seeds/admin tooling and log in through the same `POST /auth/login` endpoint with `active_platform: admin`.
- **Account lockout is per-user, cross-IP.** `LoginAttemptTracker` keys by `userId`, so an attacker rotating IPs cannot bypass it. Counter is reset on successful login.

## State machines
```
auth_tokens:   created → used (used_at set) → garbage-collected after expires_at

user_sessions: created (used_at = null)
                 │
                 ├── refresh: pessimistic-write lock → used_at = now() → new session created
                 ├── reuse-detected: every session for the user is deleted (security event)
                 ├── logout: row deleted by sessionId
                 └── expired: deleted by job (deferred — §H10)

oauth_state:   issued (Redis 10-min TTL) → consumed atomically (GET+DEL) → gone

sso_exchange:  issued (Redis 60s TTL) → consumed atomically (GET+DEL) → gone

password_reset OTP: issued (15-min TTL, single-use) → used_at set → ignored thereafter
```

## Error codes used
| Code | When |
|------|------|
| `AUTH_EMAIL_ALREADY_REGISTERED` | Register with existing email |
| `AUTH_INVALID_CREDENTIALS` | Wrong password, SSO-only account password login, or user not found (anti-enumeration) |
| `AUTH_TOKEN_INVALID` | Verification/refresh token not found, or refresh-token reuse detected |
| `AUTH_TOKEN_EXPIRED` | Token past `expiresAt` |
| `AUTH_TOKEN_ALREADY_USED` | Verification/reset token already consumed |
| `AUTH_ACCOUNT_INACTIVE` | `user.isActive = false` |
| `AUTH_EMAIL_NOT_VERIFIED` | Login before email verification |
| `AUTH_ACCOUNT_LOCKED` | `LoginAttemptTracker` threshold crossed |
| `AUTH_RESET_TOKEN_INVALID` | Forgot-password OTP unknown |
| `AUTH_RESET_TOKEN_EXPIRED` | Forgot-password OTP past 15-min window |
| `AUTH_OAUTH_STATE_INVALID` | OAuth callback `state` not found in Redis (CSRF / replay) |
| `AUTH_SSO_EXCHANGE_INVALID` | `/auth/sso/exchange` code unknown, expired, or already consumed |
| `AUTH_RATE_LIMITED` | Throttler tier exceeded (returned by the global filter when `429 Too Many Requests` originates from `@nestjs/throttler`) |
| `AUTH_DEVICE_MISMATCH` | `X-Device-ID` header doesn't match JWT claim |

## Required env vars (security)
| Variable | Purpose |
|----------|---------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | HMAC-SHA256 signing keys. Independent rotation. |
| `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | Lifetimes (vercel/ms duration string). |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Claims emitted on every newly signed token. |
| `JWT_STRICT_CLAIMS` | When `true`, tokens missing `iss` / `aud` are rejected. Roll-forward toggle. |
| `SSO_TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256 key for `user_sso_providers.*_token`. |
| `SSO_EXCHANGE_CODE_TTL` | Lifetime (seconds) of the `/auth/sso/exchange` code (default `60`). |
| `LOGIN_LOCKOUT_THRESHOLD` | Failed logins per user before lockout (default `10`). |
| `LOGIN_LOCKOUT_WINDOW_MIN` | Rolling lockout window in minutes (default `15`). |
| `THROTTLE_REDIS_PREFIX` | Prefix prepended to throttler keys (default `throttle:`). |

See [.env.development](../../../.env.development) and [.env.production](../../../.env.production) for examples.

## External dependencies
- **EmailService** (global) — verification, welcome, forgot-password OTP. Mostly fire-and-forget; reset-password and verification email are awaited inside the transaction so delivery failure rolls back the token row.
- **EnvironmentsService** (global) — JWT secrets/claims/issuer/audience, Google OAuth config, encryption key, lockout knobs.
- **RedisService** (global) — backs `SsoCodeStore`, `OAuthStateStore`, `LoginAttemptTracker`, and the `@nestjs/throttler` storage.
- **UnitOfWorkService** — transactional DB access via `withTransaction()`. Used for register, verify-email, reset-password, refresh-token rotation.
- Consumed by every other module for `RequestContextService` identity.

## Deferred work
- Expired session cleanup scheduled job (§H10).
- Redis-based access token blacklist for immediate logout enforcement.
- Fingerprint-based anomaly detection / risk scoring (currently captured but not validated).
- One-time backfill script that re-writes existing `user_sso_providers` rows through the encrypted column transformer (only needed if rows existed before the encryption rollout).
