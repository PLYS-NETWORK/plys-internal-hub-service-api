# AdminAllowedEmailsController — API Specs

> **Source:** [src/modules/admin-auth/admin-allowed-emails.controller.ts](../../../../src/modules/admin-auth/admin-allowed-emails.controller.ts)
> **Base path:** `/admin/allowed-emails`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@Roles(UserRole.ADMIN_PLATFORM)`. Non-admin callers receive `403`. No `@Platform` — admins are platform-wide. The global `JwtAuthGuard` enforces auth before the role check runs.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Soft-deleted users in the join:** the list-endpoint left-join to `users` excludes rows with `deleted_at IS NOT NULL`, so a tombstoned admin account never leaks its `last_login_at`.

This surface is distinct from the OTP flow at [`/admin/auth/*`](./auth-api-specs.md). It governs **who is allowed onto the hub**, not the login itself.

## Cross-cutting errors

| HTTP | error_code                               | When                                                                                                           |
| ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                      | Missing/invalid Bearer token (global `JwtAuthGuard`).                                                          |
| 403  | (forbidden, no error_code)               | Caller is authenticated but not `UserRole.ADMIN_PLATFORM`.                                                     |
| 403  | `ADMIN_ALLOWED_EMAIL_CANNOT_REVOKE_SELF` | PATCH targeting the requester's own email (case-insensitive match).                                            |
| 404  | `ADMIN_ALLOWED_EMAIL_NOT_FOUND`          | PATCH against a missing row.                                                                                   |
| 409  | `ADMIN_ALLOWED_EMAIL_ALREADY_EXISTS`     | POST inviting an email that's already on the allow-list and active.                                            |
| 409  | `ADMIN_ALLOWED_EMAIL_REVOKED`            | POST inviting an email that's on the allow-list but `is_active = false` — re-activate via PATCH instead.       |
| 422  | (validation)                             | DTO shape failures (UUID path param, `email` not RFC-valid, `value` not boolean, `sort_by` outside whitelist). |
| 500  | (uncoded)                                | Email-provider failure during invite — the create + send transaction is rolled back, no row persists.          |

## Endpoints

### 1. Invite an email to the allow-list

- **Endpoint:** `POST /admin/allowed-emails`
- **Method:** `POST`
- **Request body:** [`InviteAdminEmailDto`](../../../../src/modules/admin-auth/dto/requests/invite-admin-email.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `email` | `string` | yes | RFC-valid email, max 255. The service trims and lower-cases before storage and lookup. |
- **Behaviour:**
  - Normalise email (`trim().toLowerCase()`).
  - Lookup via the new `AdminAllowedEmailRepository.findByEmail` (case-insensitive, ignores `is_active`).
    - Hit + active → `409 ADMIN_ALLOWED_EMAIL_ALREADY_EXISTS`.
    - Hit + revoked → `409 ADMIN_ALLOWED_EMAIL_REVOKED`. The admin must explicitly re-activate via PATCH; this keeps the audit trail clean and avoids a silent re-grant.
    - Miss → continue.
  - Inside `UnitOfWorkService.withTransaction`: insert the row (`is_active = true`, `created_by = requestContext.userId`) **and** await `EmailService.sendAdminInviteEmail`. If the email send throws, the transaction rolls back so a retry isn't blocked by a half-created row.
  - The invitation email is sent from the Ployos sender address, subject `"You're invited to the Admin Hub"`, and contains a CTA pointing to `INTERNAL_HUB_URL` (env-driven). When the requester's email is known, the copy attributes the invite (`<invitedBy> has added your email to the admin allow-list…`).
- **Response 201:** [`IAdminAllowedEmailResponse`](../../../../src/modules/admin-auth/dto/responses/interfaces/admin-allowed-email.response.interface.ts) — `last_login` is `null` on a fresh invite.

  ```ts
  {
    id: string,                 // UUID — admin_allowed_emails.id
    email: string,              // lowercased
    is_active: boolean,         // always true on a fresh invite
    created_at: string,         // ISO-8601
    last_login: string | null,  // null until the invited admin first logs in
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 409 | `ADMIN_ALLOWED_EMAIL_ALREADY_EXISTS` | Active row exists for this email. |
  | 409 | `ADMIN_ALLOWED_EMAIL_REVOKED` | Inactive row exists; admin must re-activate via PATCH. |
  | 422 | (validation) | `email` missing or not RFC-valid. |

### 2. List allow-list entries

- **Endpoint:** `GET /admin/allowed-emails`
- **Method:** `GET`
- **Query params:** [`ListAdminAllowedEmailsDto`](../../../../src/modules/admin-auth/dto/requests/list-admin-allowed-emails.dto.ts) (extends [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts))
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | Default `1`, min `1`. |
  | `limit` | `number` | no | Default `20`, min `1`, max `100`. |
  | `sort_by` | `"created_at" \| "email"` | no | Whitelisted via `IsIn`; default `created_at`. Anything outside fails 422. |
  | `order_by` | `"ASC" \| "DESC"` | no | Default `DESC`. |
  | `is_active` | `boolean` | no | Strings `"true"` / `"1"` coerce to `true`; `"false"` / `"0"` coerce to `false`. |
  | `keywords` | `string` | no | Case-insensitive substring on `email`, length 1–80. Trimmed before validation. |
- **Behaviour:**
  - Builds a `QueryBuilder` on `admin_allowed_emails ae` with a manual `LEFT JOIN users u ON LOWER(u.email) = LOWER(ae.email) AND u.platform = 'ADMIN_PLATFORM' AND u.deleted_at IS NULL` so each entry can carry the linked admin's `last_login_at`. There is no FK between the two tables — the relation is keyed by lower-cased email + admin platform.
  - Applies optional filters; default order is `ae.created_at DESC` with `addOrderBy('ae.id', 'ASC')` as a stable tie-breaker.
  - Uses `getRawAndEntities()` to read the joined `last_login_at` alongside the entity, plus a separate `getCount()` for total.
  - Default behaviour returns active **and** revoked rows; pass `?is_active=true` to narrow.
- **Response 200:** `PageDto<IAdminAllowedEmailResponse>`

  ```ts
  {
    data: [
      {
        id: string,
        email: string,
        is_active: boolean,
        created_at: string,
        last_login: string | null   // joined from users.last_login_at; null until first login
      }
    ],
    meta: {
      page: number,
      limit: number,
      itemCount: number,
      pageCount: number,
      hasPreviousPage: boolean,
      hasNextPage: boolean
    }
  }
  ```

### 3. Set `is_active` on an entry

- **Endpoint:** `PATCH /admin/allowed-emails/:id/active`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4) — validated by `ParseUUIDPipe`.
- **Request body:** [`SetBooleanFlagDto`](../../../../src/modules/admin-auth/dto/requests/set-boolean-flag.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `value` | `boolean` | yes | New flag value. |
- **Behaviour:**
  1. Load via `uow.adminAllowedEmails.findById(id)`. Miss → `404 ADMIN_ALLOWED_EMAIL_NOT_FOUND`.
  2. **Self-block:** if `target.email.toLowerCase() === requestContext.email.toLowerCase()` → `403 ADMIN_ALLOWED_EMAIL_CANNOT_REVOKE_SELF`. The block runs before any mutation, regardless of the new `value` — preventing both a self-revocation and a no-op self-reactivation.
  3. Set `target.is_active = dto.value`; save.
  4. **Idempotent.** Re-applying the same value resaves the row but produces no observable diff. **Does not re-send the invite email** when flipping back to `true` — those are two distinct user-stories.
- **Response 200:** `{ data: null }` with `messageKey = "success.admin.allowed_email_active_updated"`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 403 | `ADMIN_ALLOWED_EMAIL_CANNOT_REVOKE_SELF` | Target row's email matches the requester's email (case-insensitive). |
  | 404 | `ADMIN_ALLOWED_EMAIL_NOT_FOUND` | Row missing for the given id. |
  | 422 | (validation) | `value` not a boolean / `id` not a UUID. |

---

## Interaction with the OTP login flow

The OTP request/verify endpoints at [`/admin/auth/*`](./auth-api-specs.md) call `AdminAllowedEmailRepository.findActiveByEmail` (active rows only). The endpoints above govern that table:

- Inviting an email creates an active row → the OTP flow accepts it.
- Setting `is_active = false` keeps the row but locks the holder out → the OTP flow rejects with `403 ADMIN_AUTH_EMAIL_NOT_ALLOWED`.
- Re-activating (`value = true`) restores OTP access without re-sending the invitation email.

## Cross-links

- **Service:** [`AdminAllowedEmailsService`](../../../../src/modules/admin-auth/services/admin-allowed-emails.service.ts) — owns the QueryBuilder for the join, the transactional invite, and the self-block guard.
- **Repository:** [`AdminAllowedEmailRepository`](../../../../src/modules/unit-of-work/repositories/admin/admin-allowed-email.repository.ts) — the new `findByEmail` lives alongside the original `findActiveByEmail`.
- **Email service:** [`EmailService.sendAdminInviteEmail`](../../../../src/common/modules/email/email.service.ts) → renders [`admin-invite.template.ejs`](../../../../src/common/modules/email/templates/admin/admin-invite.template.ejs) via [`buildAdminInviteEmail`](../../../../src/common/modules/email/templates/admin/admin-invite.template.ts).
- **Env:** `INTERNAL_HUB_URL` — exposed via `EnvironmentsService.internalHubUrl`. See `.env.example`.
- **Pagination utilities:** [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts), [`PageDto`](../../../../src/common/dto/page.dto.ts), [`PageMetaDto`](../../../../src/common/dto/page-meta.dto.ts).
- **Admin controller convention precedent:** [`BusinessProfilesAdminController`](../../../../src/modules/profiles/business/business-profiles-admin.controller.ts) — same shape (class-level `@Roles(UserRole.ADMIN_PLATFORM)`, separate `*-admin.controller.ts`, `{ value: bool }` PATCH body for booleans).
- **OTP flow spec (sibling):** [`auth-api-specs.md`](./auth-api-specs.md).
