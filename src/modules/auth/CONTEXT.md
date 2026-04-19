# Auth & Identity — Business Context

## Purpose
Owns every identity row and credential/session that authenticates it. A single human may hold up to **three independent accounts** — one per platform (`business`, `consultant`, `admin`) — each with its own email/password and its own profile. This module never joins those accounts together.

## Tables owned
- `users` — identity rows, **one per (email, platform)**. The `platform` column is immutable; email uniqueness is enforced per-platform via a functional unique index on `(platform, LOWER(email))`.
- `auth_tokens` — short-lived tokens for email verification, password reset, and magic links. Tokens are stored as SHA-256 hashes; the raw token is only ever sent via email. Each token is scoped to a single `user_id` and therefore a single platform.
- `user_sso_providers` — OAuth/SSO links (Google, LinkedIn, GitHub). Uniqueness is `(platform, provider, provider_user_id)` so the same Google account may independently link to a Business user and a Consultant user. `access_token` / `refresh_token` must be encrypted at rest.
- `user_sessions` — active login sessions. The owning user's platform is read from `users.platform`; no denormalized copy lives on the session row. Each device creates a separate session. Columns include `device_id` (client-generated UUID for session binding) and `fingerprint` (client-side hash for future risk scoring).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | `@Public` | Register with email/password → sends verification email |
| POST | `/auth/verify-email` | `@Public` | Verify email with token → sends welcome email |
| POST | `/auth/login` | `@Public` | Login with email/password, requires verified email |
| POST | `/auth/refresh` | `@Public` + `RefreshTokenGuard` | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | `@JwtAuthGuard` | Revoke current session (hard delete) |
| GET | `/auth/me` | `@JwtAuthGuard` | Get current user profile |
| POST | `/auth/change-password` | `@JwtAuthGuard` | Change password → revokes all other sessions |
| GET | `/auth/sso/google` | `@Public` | Initiate Google OAuth redirect (web flow) |
| GET | `/auth/sso/google/callback` | `@Public` + `GoogleCallbackGuard` | Google OAuth callback → redirect with tokens |
| POST | `/auth/sso/google/token` | `@Public` | Exchange Google ID token for platform tokens (SPA/mobile) |

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
5. Verification email sent fire-and-forget with `userName = company_name | full_name` — failure does not roll back.
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
2. Check: `isActive`, `passwordHash` exists (not SSO-only), bcrypt compare, `isEmailVerified`.
3. Update `lastLoginAt`.
4. `createSession()` → returns `{ access_token, refresh_token, expires_in, user }`.

### Session Creation (`createSession`)
1. Raw refresh token = `randomBytes(48).base64url()`, stored as SHA-256 hex in `user_sessions.session_token`.
2. Session row includes: `userId`, `deviceId`, `fingerprint`, `ipAddress`, `userAgent`, `expiresAt`. Platform is **not** stored on the session — it is read from `user.platform` whenever needed (e.g., on refresh).
3. JWT payload: `{ sub, email, role, activePlatform, sessionId, deviceId }`. `activePlatform` equals `user.platform`.
4. Access token signed with `JWT_ACCESS_SECRET`, expiry from `JWT_ACCESS_EXPIRATION` (default 15m).
5. Response projected through `AuthResponseDto` → `UserResponseDto` (snake_case via `@Expose`).

### Token Refresh (Refresh Token Rotation)
1. Client sends `{ refresh_token }` in body (snake_case; Passport extracts from `refresh_token` field).
2. SHA-256 → lookup `UserSession` by `sessionToken` (relation: `user`).
3. Validate not expired. If expired: delete session, throw `AUTH_TOKEN_EXPIRED`.
4. **Rotation**: delete old session row, create entirely new session with new refresh token. The platform for the new JWT is read from `session.user.platform`.
5. This means each refresh token is single-use — replay of an old token fails.

### Logout
1. Hard-delete `UserSession` row by `sessionId` from JWT.
2. Note: the access token (15m TTL) remains valid until expiry. A Redis blacklist can be added later for stricter requirements.

### Change Password
1. Validate current password via bcrypt compare.
2. Transaction: update `passwordHash` (bcrypt 12 rounds), delete all `UserSession` rows for this user **except** the current session.
3. All other devices are forced to re-login.

### Google SSO — Web Redirect Flow
1. `GET /auth/sso/google` → `GoogleOAuthGuard` redirects to Google OAuth consent screen (scope: `email`, `profile`).
2. `GET /auth/sso/google/callback` → `GoogleCallbackGuard` exchanges auth code → `GoogleStrategy.validate()` returns normalized `GoogleProfile`.
3. `ssoLogin()` handles user upsert (see below).
4. Redirect to frontend with `access_token` + `refresh_token` as query params.

### Google SSO — Token Exchange Flow (SPA/Mobile)
1. Client handles Google sign-in popup/redirect and obtains a Google ID token.
2. `POST /auth/sso/google/token` with `{ id_token, active_platform }`.
3. Server verifies ID token via `google-auth-library` `OAuth2Client.verifyIdToken()` with audience check.
4. `ssoLogin()` handles user upsert.
5. Returns `AuthResponseDto` in standard response envelope.

### SSO User Upsert Logic (`ssoLogin`)
SSO is allowed only for `business` and `consultant`. `admin` SSO is rejected with `403`.
1. Lookup `UserSsoProvider` by `(platform, provider, providerUserId)` — the identity is platform-scoped.
2. **If linked**: validate `user.isActive` → refresh SSO tokens → `createSession()` for that platform.
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
  role: UserRole;        // e.g. USER, ADMIN_PLATFORM
  activePlatform: ActivePlatform; // 'business' | 'consultant' | 'admin' — equals user.platform
  sessionId: string;     // user_sessions.id — for precise logout/refresh
  deviceId: string | null;
  iat?: number;
  exp?: number;
}
```

## Guards & decorators

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` (global) | Validates access token. Skipped on `@Public()` routes. |
| `RolesGuard` (global) | Checks `@Roles()` metadata against `request.user.role`. |
| `PlatformGuard` (global) | Checks `@Platform()` metadata against `request.user.activePlatform`. |
| `RefreshTokenGuard` | Validates refresh token JWT from body field `refresh_token`. |
| `GoogleOAuthGuard` | Initiates Google OAuth redirect. |
| `GoogleCallbackGuard` | Handles Google OAuth callback. |

- `@Public()` — skips `JwtAuthGuard`.
- `@Platform(ActivePlatform.BUSINESS)` — restricts endpoint to business platform users.
- `@CurrentUser()` — extracts `JwtPayload` from `request.user`.

## Device binding & fingerprinting
- **`X-Device-ID` header**: client-generated UUID sent on every request. Stored in JWT `deviceId` and `user_sessions.device_id`. `JwtStrategy` validates that the header matches the JWT claim — mismatch triggers `401 Device mismatch`.
- **`X-Fingerprint` header**: client-side fingerprint library hash. Stored in `user_sessions.fingerprint` for future anomaly detection / risk scoring. Not currently validated.

## Key invariants
- **Email uniqueness is per-platform and case-insensitive.** Enforced at the DB via a functional unique index on `(platform, LOWER(email))`. The same email may therefore exist at most three times (business, consultant, admin) as three independent accounts.
- **`users.platform` is immutable.** An identity never moves between platforms; a user who wants both sides registers twice.
- **`password_hash` is nullable** — SSO-only accounts never have one.
- **Token hashes never decode.** `auth_tokens.token_hash` stores SHA-256 of the raw token; the server rehashes the submitted value to compare.
- **SSO tokens must be encrypted at rest.** Plaintext in `user_sso_providers.access_token` / `refresh_token` is a known gap (schema fix §H8).
- **SSO identity is platform-scoped.** `(platform, provider, provider_user_id)` is unique, so the same Google account can link to a Business and a Consultant user independently. SSO is rejected for `admin`.
- **Session cleanup.** Sessions with `expires_at < now()` should be deleted by a scheduled job (not yet implemented — schema fix §H10).
- **Refresh Token Rotation.** Each refresh token is single-use. On refresh, the old session is deleted and a new one created with a fresh token; the platform is re-derived from `user.platform`.
- **Admin accounts are not self-registered.** `POST /auth/register` rejects `active_platform: admin` with 403. Admins are created via seeds/admin tooling and log in through the same `POST /auth/login` endpoint with `active_platform: admin`.

## State machines
```
auth_tokens:   created → used (used_at set) → garbage-collected after expires_at
user_sessions: created → refreshed (old deleted, new created) → logout (deleted) OR expired (deleted by job)
```

## Error codes used
| Code | When |
|------|------|
| `AUTH_EMAIL_ALREADY_REGISTERED` | Register with existing email |
| `AUTH_INVALID_CREDENTIALS` | Wrong password, SSO-only account password login, or user not found (anti-enumeration) |
| `AUTH_TOKEN_INVALID` | Verification/refresh token not found |
| `AUTH_TOKEN_EXPIRED` | Token past `expiresAt` |
| `AUTH_TOKEN_ALREADY_USED` | Verification token already consumed |
| `AUTH_ACCOUNT_INACTIVE` | `user.isActive = false` |
| `AUTH_EMAIL_NOT_VERIFIED` | Login before email verification |

## External dependencies
- **EmailService** (global) — sends verification, welcome emails. Fire-and-forget; failures logged but don't block flows.
- **EnvironmentsService** (global) — JWT secrets/expiration, Google OAuth config, frontend URL.
- **UnitOfWorkService** — transactional DB access via `withTransaction()`.
- Consumed by every other module for `@CurrentUser()` resolution and `RequestContextService` identity.

## Deferred work
- `POST /auth/forgot-password` — create `AuthToken(PASSWORD_RESET)`, send OTP email (entity + enum already exist).
- `POST /auth/reset-password` — consume reset token, set new password.
- SSO token encryption at rest (§H8).
- Expired session cleanup scheduled job (§H10).
- Redis-based access token blacklist for immediate logout enforcement.
