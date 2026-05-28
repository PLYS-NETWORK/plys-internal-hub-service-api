# Consultant Account Gates

> **Enforcement owners:**
>
> - Identity-service — auth endpoints (`BasicAuthService`, `SsoAuthService`)
> - Consultant-service — onboarding profile submit (`ConsultantOnboardingService`)
> - Consultant-service — skill-exam routes (`NotBannedGuard`, `assertSkillExamUserNotBanned`)
>
> **Related specs:**
>
> - Platform sign-in endpoints: [`platform-auth-api-specs.md`](./platform-auth-api-specs.md)
> - Shared session lifecycle: [`auth-api-specs.md`](./auth-api-specs.md)
> - Onboarding flow: [`../../consultant-service/onboarding/onboarding-api-specs.md`](../../consultant-service/onboarding/onboarding-api-specs.md)
> - Admin rejection trigger: [`../../internal-admin-service/consultant-onboarding/consultant-onboarding-api-specs.md`](../../internal-admin-service/consultant-onboarding/consultant-onboarding-api-specs.md)

The consultant platform layers **two account gates** on top of the standard auth flow. Both return HTTP **403** with a `details` object so the client can render platform-specific copy. They are mutually independent — a consultant can hit one without the other.

| Gate                       | `error_code`                                                                 | Duration              | Trigger                                          |
| -------------------------- | ---------------------------------------------------------------------------- | --------------------- | ------------------------------------------------ |
| Onboarding rejection block | `CONSULTANT_ONBOARDING_BLOCKED`                                              | 3 months (time-boxed) | Admin rejects onboarding (`decision = REJECTED`) |
| CopyLeaks abuse ban        | `AUTH_ACCOUNT_INACTIVE` (auth) / `SKILL_EXAM_USER_BANNED` (skill-exam guard) | Permanent             | 3rd lifetime CopyLeaks strike on skill exams     |

---

## Gate 1 — Onboarding rejection block {#onboarding-rejection-block-read-first}

### Trigger

When an admin rejects a consultant's onboarding application:

```
POST /api/v1/admin/onboardings/:id/decide  { "decision": "REJECTED", "rejection_note": "..." }
```

The server:

1. Sets `consultant_onboardings.status = REJECTED`, `rejection_note`, `reviewed_at`.
2. Sets `consultant_onboardings.blocked_until = now + 3 months`.
3. Sends a rejection email with the reason and block lift date.
4. Does **not** change `users.is_active` — the block is time-boxed only.

### Data model

| Column          | Table                    | Meaning                                                         |
| --------------- | ------------------------ | --------------------------------------------------------------- |
| `blocked_until` | `consultant_onboardings` | ISO timestamp; while `blocked_until > now()` the gate is active |
| `status`        | `consultant_onboardings` | `REJECTED` on the row that carries the block                    |

The check reads the consultant's **latest onboarding row** (`findByUserId`). Once `blocked_until` passes, login and re-onboarding resume normally without admin intervention.

### Error response

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

| Field                   | Type     | Description                             |
| ----------------------- | -------- | --------------------------------------- |
| `details.blocked_until` | `string` | ISO-8601 timestamp when the block lifts |

### Affected endpoints

While `blocked_until > now`:

| Endpoint                                       | Service    | Block enforced? | Notes                                                        |
| ---------------------------------------------- | ---------- | --------------- | ------------------------------------------------------------ |
| `POST /auth/register`                          | identity   | **Yes**         | Re-registration on same email + `consultant` platform        |
| `POST /auth/login`                             | identity   | **Yes**         | After credential + email-verified checks                     |
| `POST /auth/sso/exchange`                      | identity   | **Yes**         | Via underlying `ssoLogin` during callback                    |
| `POST /auth/sso/google/token`                  | identity   | **Yes**         | Via `ssoLogin`                                               |
| `POST /consultant/onboarding/profile`          | consultant | **Yes**         | Explicit check in `submitProfile` — covers stale sessions    |
| `GET /consultant/onboarding/status`            | consultant | No              | Returns `blocked_until` in the response body                 |
| `GET /consultant/onboarding/questions`         | consultant | No\*            | Requires Bearer token; new sign-in is blocked at auth layer  |
| `POST /consultant/onboarding/interview/submit` | consultant | No\*            | Same as above                                                |
| All other authenticated consultant routes      | various    | No\*            | Unreachable in practice — client cannot obtain a fresh token |

\*If the consultant still holds a **pre-rejection session**, these routes may respond until the token expires or is revoked. The client should treat `403 CONSULTANT_ONBOARDING_BLOCKED` on login/register/profile as a signal to clear local auth state and route to the blocked-onboarding landing (`/onboarding/blocked`).

### Client handling

1. On `403 CONSULTANT_ONBOARDING_BLOCKED`, read `details.blocked_until` and show the block lift date.
2. Clear stored tokens and route to `/onboarding/blocked`.
3. Poll `GET /consultant/onboarding/status` after `blocked_until` passes before retrying sign-in.
4. Real-time hint: the `consultant_onboarding_rejected` notification includes `blocked_until` and `redirect_url` — see [`notifications-consultant-events-api-specs.md`](../../consultant-service/notifications/notifications-consultant-events-api-specs.md).

---

## Gate 2 — Permanent ban (CopyLeaks abuse)

### Trigger

On the **3rd lifetime CopyLeaks strike** during skill-exam submission (`maxAiScore > 30`):

1. `users.is_active = false`
2. `users.banned_at = now()`
3. `users.ban_reason = 'AI_CONTENT_ABUSE'`
4. **All `user_sessions` rows for the user are deleted** in the same transaction — cached JWTs fail immediately on the next request.
5. Notifications: `consultant_account_banned` (consultant) + `admin_consultant_banned` (admin fan-out).

See [`skill-exams-api-specs.md`](../../consultant-service/skill-exams/skill-exams-api-specs.md) for the strike counter and cooldown mechanics.

### Error responses

**At auth layer** (`POST /auth/login`, SSO paths) — checked before onboarding block:

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

**At skill-exam controller** (`NotBannedGuard`) — defence-in-depth if a stale JWT somehow reaches the controller:

```json
{
  "status_code": 403,
  "message": "...",
  "error_code": "SKILL_EXAM_USER_BANNED",
  "data": null,
  "details": { "ban_reason": "AI_CONTENT_ABUSE" },
  "timestamp": "2026-05-17T10:11:00.000Z",
  "path": "/api/v1/consultant/skill-exams/..."
}
```

| Field                | Type     | Description                                     |
| -------------------- | -------- | ----------------------------------------------- |
| `details.ban_reason` | `string` | Currently `AI_CONTENT_ABUSE` for CopyLeaks bans |

### Affected endpoints

| Endpoint group                                  | Block enforced? | `error_code`                                                                             |
| ----------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `POST /auth/login`                              | **Yes**         | `AUTH_ACCOUNT_INACTIVE`                                                                  |
| `POST /auth/sso/exchange`                       | **Yes**         | `AUTH_ACCOUNT_INACTIVE`                                                                  |
| `POST /auth/sso/google/token`                   | **Yes**         | `AUTH_ACCOUNT_INACTIVE`                                                                  |
| `POST /auth/register`                           | No              | Account already exists — login path hits ban first                                       |
| `POST /auth/refresh`                            | **Yes**         | Session deleted at ban time → `AUTH_TOKEN_INVALID`                                       |
| All authenticated consultant routes             | **Yes**         | Session lookup fails or `NotBannedGuard` → `SKILL_EXAM_USER_BANNED` on skill-exam routes |
| Skill-exam routes (`/consultant/skill-exams/*`) | **Yes**         | `NotBannedGuard` + service-level `assertSkillExamUserNotBanned`                          |

> Business accounts can also receive `AUTH_ACCOUNT_INACTIVE` when manually disabled, but the CopyLeaks 3-strike auto-ban path is **consultant-only**.

### Client handling

1. On `403 AUTH_ACCOUNT_INACTIVE` with `ban_reason`, show permanent ban copy (no retry date).
2. Clear all stored tokens immediately — sessions are revoked server-side at ban time.
3. Do not attempt token refresh; expect `401 AUTH_TOKEN_INVALID`.

---

## Combined gate matrix

Quick reference for which gate fires where on the **consultant** platform:

| Endpoint                              | Onboarding block                | Permanent ban                            |
| ------------------------------------- | ------------------------------- | ---------------------------------------- |
| `POST /auth/register`                 | `CONSULTANT_ONBOARDING_BLOCKED` | —                                        |
| `POST /auth/login`                    | `CONSULTANT_ONBOARDING_BLOCKED` | `AUTH_ACCOUNT_INACTIVE`                  |
| `POST /auth/sso/exchange`             | `CONSULTANT_ONBOARDING_BLOCKED` | `AUTH_ACCOUNT_INACTIVE`                  |
| `POST /auth/sso/google/token`         | `CONSULTANT_ONBOARDING_BLOCKED` | `AUTH_ACCOUNT_INACTIVE`                  |
| `POST /auth/refresh`                  | —                               | `AUTH_TOKEN_INVALID` (sessions revoked)  |
| `POST /consultant/onboarding/profile` | `CONSULTANT_ONBOARDING_BLOCKED` | `GENERIC_UNAUTHORIZED` / session invalid |
| `/consultant/skill-exams/*`           | Unreachable (no token)          | `SKILL_EXAM_USER_BANNED`                 |

**Check order at login (identity-service):**

```
1. User exists?
2. users.is_active = true?  → AUTH_ACCOUNT_INACTIVE
3. Password valid?
4. Email verified?
5. consultant_onboardings.blocked_until > now?  → CONSULTANT_ONBOARDING_BLOCKED
6. Issue session
```

---

## Error code reference

| `error_code`                    | HTTP | Gate             | Where it fires                                                                   |
| ------------------------------- | ---- | ---------------- | -------------------------------------------------------------------------------- |
| `CONSULTANT_ONBOARDING_BLOCKED` | 403  | Onboarding block | `/auth/register`, `/auth/login`, `/auth/sso/*`, `/consultant/onboarding/profile` |
| `AUTH_ACCOUNT_INACTIVE`         | 403  | Permanent ban    | `/auth/login`, `/auth/sso/exchange`, `/auth/sso/google/token`                    |
| `SKILL_EXAM_USER_BANNED`        | 403  | Permanent ban    | `/consultant/skill-exams/*` (`NotBannedGuard`)                                   |
| `AUTH_TOKEN_INVALID`            | 401  | Permanent ban    | `/auth/refresh` after session revocation at ban time                             |

---

## Cross-links

- **Platform auth endpoints:** [`platform-auth-api-specs.md`](./platform-auth-api-specs.md)
- **Shared session (refresh / logout / me):** [`auth-api-specs.md`](./auth-api-specs.md)
- **Consultant onboarding endpoints:** [`onboarding-api-specs.md`](../../consultant-service/onboarding/onboarding-api-specs.md)
- **Skill-exam strike / ban mechanics:** [`skill-exams-api-specs.md`](../../consultant-service/skill-exams/skill-exams-api-specs.md)
- **Admin rejection trigger:** [`consultant-onboarding-api-specs.md`](../../internal-admin-service/consultant-onboarding/consultant-onboarding-api-specs.md)
- **Rejection notification payload:** [`notifications-consultant-events-api-specs.md`](../../consultant-service/notifications/notifications-consultant-events-api-specs.md)
