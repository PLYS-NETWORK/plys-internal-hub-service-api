# Auth & Identity — Business Context

## Purpose
Owns the single root identity per human (`users`) and every credential/session that authenticates them. Does **not** own profiles, roles, or permissions — a user becomes a Business or Consultant by selecting an `active_platform` at login time; this module only proves who the user is and which platform they are currently operating on.

## Tables owned
- `users` — root identity (one row per human, regardless of platform).
- `auth_tokens` — short-lived tokens for email verification, password reset, and magic links. Tokens are stored as SHA-256 hashes; the raw token is only ever sent via email.
- `user_sso_providers` — OAuth/SSO links (Google, LinkedIn, GitHub). `access_token` and `refresh_token` must be encrypted at rest.
- `user_sessions` — active login sessions. `active_platform` tracks which side of the marketplace the session is operating on. Each device creates a separate session row. Columns include `device_id` (client-generated UUID for session binding) and `fingerprint` (client-side hash for future risk scoring).

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
1. Client sends `{ email, password, first_name, last_name, active_platform }`.
2. Case-insensitive `LOWER(email)` uniqueness check → 409 if duplicate.
3. Password hashed with bcrypt (12 rounds).
4. `User` row created with `isEmailVerified: false`.
5. `AuthToken` (type `EMAIL_VERIFICATION`) created — raw token = `randomBytes(32).hex()`, stored as SHA-256.
6. Verification email sent (fire-and-forget — failure does not roll back).
7. Verification URL: `FRONTEND_URL/verify-email?token=<raw>`, expires in 24 hours.

### Email Verification
1. Client submits raw token.
2. SHA-256 → lookup in `auth_tokens` by `tokenHash` + type `EMAIL_VERIFICATION`.
3. Validate: not already used (`usedAt`), not expired (`expiresAt`).
4. Transaction: mark `usedAt`, set `user.isEmailVerified = true`, `emailVerifiedAt = now`.
5. Welcome email sent (fire-and-forget).

### Email/Password Login
1. Find user by `LOWER(email)` — returns generic "invalid credentials" if not found (prevents enumeration).
2. Check: `isActive`, `passwordHash` exists (not SSO-only), bcrypt compare, `isEmailVerified`.
3. Update `lastLoginAt`.
4. `createSession()` → returns `{ access_token, refresh_token, expires_in, user }`.

### Session Creation (`createSession`)
1. Raw refresh token = `randomBytes(48).base64url()`, stored as SHA-256 hex in `user_sessions.session_token`.
2. Session row includes: `userId`, `activePlatform`, `deviceId`, `fingerprint`, `ipAddress`, `userAgent`, `expiresAt`.
3. JWT payload: `{ sub, email, role: activePlatform, activePlatform, sessionId, deviceId }`.
4. Access token signed with `JWT_ACCESS_SECRET`, expiry from `JWT_ACCESS_EXPIRATION` (default 15m).
5. Response projected through `AuthResponseDto` → `UserResponseDto` (snake_case via `@Expose`).

### Token Refresh (Refresh Token Rotation)
1. Client sends `{ refresh_token }` in body (snake_case; Passport extracts from `refresh_token` field).
2. SHA-256 → lookup `UserSession` by `sessionToken`.
3. Validate not expired. If expired: delete session, throw `AUTH_TOKEN_EXPIRED`.
4. **Rotation**: delete old session row, create entirely new session with new refresh token.
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
1. Lookup `UserSsoProvider` by `(provider, providerUserId)`.
2. **If linked**: validate `user.isActive` → update SSO tokens → `createSession()`.
3. **If not linked**: check if email matches existing user.
   - **Email exists**: link SSO provider to existing user. Auto-verify email if not verified (SSO confirms ownership).
   - **Email not found**: create new `User` with `isEmailVerified: true`, `passwordHash: null`. Send welcome email.
4. Create `UserSsoProvider` row linking provider identity to user.
5. `createSession()` for the target platform.

## JWT payload structure
```typescript
interface JwtPayload {
  sub: string;           // user.id (UUID)
  email: string;
  role: string;          // = activePlatform ('business' | 'consultant')
  activePlatform: ActivePlatform;
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
- **Email uniqueness is case-insensitive.** Enforced at the DB via a functional unique index on `LOWER(email)`, not a column-level UNIQUE constraint.
- **`password_hash` is nullable** — SSO-only accounts never have one.
- **Token hashes never decode.** `auth_tokens.token_hash` stores SHA-256 of the raw token; the server rehashes the submitted value to compare.
- **SSO tokens must be encrypted at rest.** Plaintext in `user_sso_providers.access_token` / `refresh_token` is a known gap (schema fix §H8).
- **`user_sessions.active_platform`** must be one of `business` | `consultant`.
- **Session cleanup.** Sessions with `expires_at < now()` should be deleted by a scheduled job (not yet implemented — schema fix §H10).
- **Refresh Token Rotation.** Each refresh token is single-use. On refresh, the old session is deleted and a new one created with a fresh token.

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
