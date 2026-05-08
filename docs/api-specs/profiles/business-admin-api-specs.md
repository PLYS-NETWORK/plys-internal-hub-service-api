# BusinessProfilesAdminController — API Specs

> **Source:** [src/modules/profiles/business/business-profiles-admin.controller.ts](../../../src/modules/profiles/business/business-profiles-admin.controller.ts)
> **Base path:** `/admin/business-profiles`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@Roles(UserRole.ADMIN_PLATFORM)`. Non-admin callers receive `403`. No `@Platform` — admins are platform-wide.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Soft-deleted rows:** excluded from every read (the service applies `bp.deleted_at IS NULL` on both list and detail). There is no `?include_deleted` knob today.

## Cross-cutting errors

| HTTP | error_code                   | When                                                                             |
| ---- | ---------------------------- | -------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token (global `JwtAuthGuard`).                            |
| 403  | (forbidden, no error_code)   | Caller is authenticated but not `UserRole.ADMIN_PLATFORM` (global `RolesGuard`). |
| 404  | `BUSINESS_PROFILE_NOT_FOUND` | Target row missing or soft-deleted (`getById` and both PATCH routes).            |
| 422  | (validation)                 | DTO shape failures (UUID path param, boolean coercion, `sort_by` whitelist).     |

## Endpoints

### 1. List business profiles (paginated, filterable)

- **Endpoint:** `GET /admin/business-profiles`
- **Method:** `GET`
- **Query params:** [`ListBusinessProfilesDto`](../../../src/modules/profiles/business/dto/requests/list-business-profiles.dto.ts) (extends [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts))
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | Default `1`, min `1`. |
  | `limit` | `number` | no | Default `20`, min `1`, max `100`. |
  | `sort_by` | `"created_at" \| "updated_at" \| "company_name"` | no | Whitelisted via `IsIn`; default `created_at`. Anything outside fails 422. |
  | `order_by` | `"ASC" \| "DESC"` | no | Default `DESC`. |
  | `is_partner_platform` | `boolean` | no | Strings `"true"` / `"1"` coerce to `true`; `"false"` / `"0"` coerce to `false`. Anything else 422. |
  | `is_verified` | `boolean` | no | Same coercion rules as `is_partner_platform`. |
- **Behaviour:**
  - Joins `business_profiles` to `users` once via `leftJoinAndSelect('bp.user', 'u')` so the response can surface `email`, `register_date`, and `last_login` without an N+1.
  - Applies `bp.deleted_at IS NULL` and the optional flag filters before sorting.
  - Sorts by the resolved `sort_by` column with `addOrderBy('bp.id', 'ASC')` as a tie-breaker — keeps successive pages stable when the chosen sort key has duplicates.
  - Pagination metadata is built via [`PageMetaDto`](../../../src/common/dto/page-meta.dto.ts).
- **Response 200:** `PageDto<`[`IAdminBusinessProfileListItemResponse`](../../../src/modules/profiles/business/dto/responses/interfaces/admin-business-profile-list-item.response.interface.ts)`>`

  ```ts
  {
    data: [
      {
        id: string,                  // UUID — business_profiles.id
        user_id: string,             // UUID — auth account
        company_name: string,
        email: string,               // users.email (joined)
        phone_number: string | null,
        address_line: string | null,
        city: string | null,
        state_province: string | null,
        postal_code: string | null,
        country_code: string | null, // ISO 3166-1 alpha-2
        is_partner_platform: boolean,
        allow_payment_credit: boolean,
        is_verified: boolean,
        register_date: string,       // ISO-8601 — users.created_at (NOT NULL)
        last_login: string | null    // ISO-8601 — users.last_login_at; null until first login
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

### 2. Get a business profile by id

- **Endpoint:** `GET /admin/business-profiles/:id`
- **Method:** `GET`
- **Path params:** `id` (UUID v4) — validated by `ParseUUIDPipe`.
- **Behaviour:** Same join shape as the list endpoint, but selects a single row and rejects soft-deleted ones with `404 BUSINESS_PROFILE_NOT_FOUND`.
- **Response 200:** [`IAdminBusinessProfileDetailResponse`](../../../src/modules/profiles/business/dto/responses/interfaces/admin-business-profile-detail.response.interface.ts) — superset of the user-scoped [`IBusinessProfileResponse`](../../../src/modules/profiles/business/dto/responses/interfaces/business-profile.response.interface.ts) plus `email`, `register_date`, `last_login`.

  Full shape:

  ```ts
  {
    // From business_profiles (matches user-scoped GET /business-profiles/me)
    id: string,
    user_id: string,
    company_name: string,
    industry: string | null,
    company_size: string | null,
    website_url: string | null,
    description: string | null,
    address_line: string | null,
    city: string | null,
    state_province: string | null,
    postal_code: string | null,
    country_code: string | null,
    phone_number: string | null,
    logo_url: string | null,
    is_verified: boolean,
    is_partner_platform: boolean,
    allow_payment_credit: boolean,
    account_balance: number,
    created_at: string,        // ISO-8601 — profile creation
    // Joined from users
    email: string,
    register_date: string,     // ISO-8601 — auth account creation
    last_login: string | null  // ISO-8601 — null until first login
  }
  ```

> **Two timestamps:** `created_at` is the **profile**'s creation; `register_date` is the **user account**'s creation. They diverge whenever a user signs up before completing business onboarding.

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `BUSINESS_PROFILE_NOT_FOUND` | Row missing or soft-deleted. |

### 3. Set `is_partner_platform`

- **Endpoint:** `PATCH /admin/business-profiles/:id/partner-platform`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4)
- **Request body:** [`SetBooleanFlagDto`](../../../src/modules/profiles/business/dto/requests/set-boolean-flag.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `value` | `boolean` | yes | New flag value. |
- **Behaviour:**
  - Loads the row via `uow.businessProfiles.findByActiveId(id)` (excludes soft-deleted).
  - Sets `business_profiles.is_partner_platform = value` and saves.
  - **Idempotent.** Re-setting the existing value resaves the row but produces no observable diff.
- **Response 200:** `{ data: null }` with `messageKey = "success.business_profile.partner_platform_updated"`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `BUSINESS_PROFILE_NOT_FOUND` | Row missing or soft-deleted. |
  | 422 | (validation) | `value` not a boolean. |

### 4. Set `allow_payment_credit`

- **Endpoint:** `PATCH /admin/business-profiles/:id/payment-credit`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4)
- **Request body:** `SetBooleanFlagDto` — same shape as endpoint 3.
- **Behaviour:** Identical mechanics to endpoint 3, but flips `business_profiles.allow_payment_credit`. Idempotent.
- **Response 200:** `{ data: null }` with `messageKey = "success.business_profile.payment_credit_updated"`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `BUSINESS_PROFILE_NOT_FOUND` | Row missing or soft-deleted. |
  | 422 | (validation) | `value` not a boolean. |

---

## Migration note (legacy routes removed)

The earlier one-way admin routes that lived on the user-scoped controller have been removed in this change:

| Removed route                                 | Replacement                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `PATCH /business-profiles/:id/partner`        | `PATCH /admin/business-profiles/:id/partner-platform { "value": true }` |
| `PATCH /business-profiles/:id/payment-credit` | `PATCH /admin/business-profiles/:id/payment-credit  { "value": true }`  |

Both legacy routes used to set the flag to `true` only; the new routes are bidirectional. Any caller that previously invoked the legacy paths must be updated.

The legacy i18n keys `success.business_profile.partner_marked` and `success.business_profile.payment_credit_allowed` were removed in the same change; the new messages are `success.business_profile.partner_platform_updated` and `success.business_profile.payment_credit_updated`.

## Cross-links

- **Service:** [BusinessProfilesAdminService](../../../src/modules/profiles/business/business-profiles-admin.service.ts) — owns the QueryBuilder for the join, the `SORT_COLUMN_MAP` whitelist, and the bidirectional setters.
- **Repository accessor:** `uow.businessProfiles` from [UnitOfWorkService](../../../src/modules/unit-of-work/unit-of-work.service.ts).
- **User-scoped surface (separate controller):** [`BusinessProfilesController`](../../../src/modules/profiles/business/business-profiles.controller.ts) — the `/business-profiles` routes used by business owners (onboard, get/update own profile).
- **Pagination utilities:** [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts), [`PageDto`](../../../src/common/dto/page.dto.ts), [`PageMetaDto`](../../../src/common/dto/page-meta.dto.ts).
- **Admin controller convention precedent:** [`AiProviderKeyAdminController`](../../../src/modules/ai-provider-key/ai-provider-key-admin.controller.ts) — same shape (`@Controller('admin/...')`, class-level `@Roles(UserRole.ADMIN_PLATFORM)`, no `@Platform`).
