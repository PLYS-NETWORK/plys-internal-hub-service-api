# Auth & Identity — Business Context

## Purpose
Owns the single root identity per human (`users`) and every credential/session that authenticates them. Does **not** own profiles, roles, or permissions — a user becomes a Business or Consultant by having a profile in those modules; this module only proves who the user is.

## Tables owned
- `users` — root identity (one row per human, regardless of platform).
- `auth_tokens` — short-lived tokens for email verification, password reset, and magic links. Tokens are stored as SHA-256 hashes; the raw token is only ever sent via email.
- `user_sso_providers` — OAuth/SSO links (Google, LinkedIn, GitHub). `access_token` and `refresh_token` must be encrypted at rest.
- `user_sessions` — active login sessions. `active_platform` tracks which side of the marketplace the session is operating on; switching sides updates this column rather than creating a new session.

## Key invariants
- **Email uniqueness is case-insensitive.** Enforced at the DB via a functional unique index on `LOWER(email)`, not a column-level UNIQUE constraint. (See schema fix §C7.)
- **`password_hash` is nullable** — SSO-only accounts never have one.
- **Token hashes never decode.** `auth_tokens.token_hash` stores SHA-256 of the raw token; the server rehashes the submitted value to compare.
- **SSO tokens must be encrypted at rest.** Plaintext in `user_sso_providers.access_token` / `refresh_token` is a breach. (Schema fix §H8 — encryption wrapper is a follow-up.)
- **`user_sessions.active_platform`** must be one of `business` | `consultant`. Switching platforms does not require re-authentication — the session row is updated in place.
- **Session cleanup.** Sessions with `expires_at < now()` are deleted by a scheduled job (not yet implemented — see schema fix §H10).

## State machines
No finite-state machines in this module. Auth tokens have a linear lifecycle:

```
auth_tokens:  created → used (used_at set) → garbage-collected after expires_at
user_sessions: created → (active_platform may change) → expires OR revoked → deleted
```

## External dependencies
- Consumed by every other module for `@CurrentUser()` resolution.
- Writes `notifications` (via Notifications module) for email verification success / password reset success.
- Read by Profiles module to associate a user with a `business_profiles` / `consultant_profiles` row.

## Critical edge cases
- **Concurrent login from multiple devices** — each creates a new `user_sessions` row; device-binding in JWT guards ensures tokens from one device don't work on another.
- **SSO account claim collision** — if a user signs up with email+password and later logs in with Google using the same email, the SSO row is linked to the existing `users` row, not a duplicate created.
- **Expired token replay** — filter out `auth_tokens` where `expires_at < now()` OR `used_at IS NOT NULL` before validating a submitted token.
- **Case-insensitive email in lookups** — always compare via `LOWER(email) = LOWER($1)` so a user who signed up as `Foo@Bar.com` can log in as `foo@bar.com`.
