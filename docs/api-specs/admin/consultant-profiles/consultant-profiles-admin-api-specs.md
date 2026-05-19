# ConsultantProfilesAdminController — API Specs

> **Source:** [src/modules/profiles/consultant/consultant-profiles-admin.controller.ts](../../../../src/modules/profiles/consultant/consultant-profiles-admin.controller.ts)
> **Base path:** `/admin/consultant-profiles`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@Roles(UserRole.ADMIN_PLATFORM)`. Non-admin callers receive `403`. No `@Platform` — admins are platform-wide.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Soft-deleted rows:** excluded from every read (the service applies `cp.deleted_at IS NULL` on both list and detail). There is no `?include_deleted` knob today.
> **Approval gate:** the **list** endpoint hard-filters to consultants who have passed onboarding approval (`consultant_profiles.is_verified = true`). This column is atomically set when an admin moves `consultant_onboardings.status` to `APPROVED` — see [consultant-onboarding-api-specs.md](../consultant-onboarding/consultant-onboarding-api-specs.md). The **detail** endpoint does NOT apply this filter so admins can inspect mid-onboarding rows.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                             |
| ---- | ------------------------------ | -------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token (global `JwtAuthGuard`).                            |
| 403  | (forbidden, no error_code)     | Caller is authenticated but not `UserRole.ADMIN_PLATFORM` (global `RolesGuard`). |
| 404  | `CONSULTANT_PROFILE_NOT_FOUND` | Target row missing or soft-deleted (`getById`).                                  |
| 422  | (validation)                   | DTO shape failures (UUID path param, boolean coercion, `sort_by` whitelist).     |

## Endpoints

### 1. List consultant profiles (paginated, approved-only)

- **Endpoint:** `GET /admin/consultant-profiles`
- **Method:** `GET`
- **Query params:** [`ListConsultantProfilesAdminDto`](../../../../src/modules/profiles/consultant/dto/requests/list-consultant-profiles-admin.dto.ts) (extends [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts))
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | Default `1`, min `1`. |
  | `limit` | `number` | no | Default `20`, min `1`, max `100`. |
  | `sort_by` | `"created_at" \| "updated_at" \| "full_name"` | no | Whitelisted via `IsIn`; default `created_at`. Anything outside fails 422. |
  | `order_by` | `"ASC" \| "DESC"` | no | Default `DESC`. |
  | `has_notification_priority` | `boolean` | no | Strings `"true"` / `"1"` coerce to `true`; `"false"` / `"0"` coerce to `false`. Anything else 422. |

  > `is_verified` is **not** a query parameter. The list is hard-filtered to `is_verified = true`; callers that need unverified rows must use the detail endpoint or the onboarding admin surface.

- **Behaviour:**
  - Joins `consultant_profiles` to `users` once via `leftJoinAndSelect('cp.user', 'u')` so the response can surface `email`, `register_date`, and `last_login` without an N+1.
  - Applies `cp.deleted_at IS NULL AND cp.is_verified = TRUE` and the optional flag filter before sorting.
  - Sorts by the resolved `sort_by` column with `addOrderBy('cp.id', 'ASC')` as a tie-breaker — keeps successive pages stable when the chosen sort key has duplicates.
  - Re-presigns `avatar_url` for every row via [`UrlResolverService.resolveMany`](../../../../src/common/modules/file-storage/services/url-resolver.service.ts) so clients receive a freshly-signed URL (the stored value is the upload-time presign with a short TTL).
  - Pagination metadata is built via [`PageMetaDto`](../../../../src/common/dto/page-meta.dto.ts).
- **Response 200:** `PageDto<`[`IAdminConsultantProfileListItemResponse`](../../../../src/modules/profiles/consultant/dto/responses/interfaces/admin-consultant-profile-list-item.response.interface.ts)`>`

  ```ts
  {
    data: [
      {
        id: string,                       // UUID — consultant_profiles.id
        user_id: string,                  // UUID — auth account
        full_name: string,
        avatar_url: string | null,        // presigned URL; null when no avatar uploaded
        email: string,                    // users.email (joined)
        phone_number: string | null,
        city: string | null,
        country_code: string | null,      // ISO 3166-1 alpha-2
        years_of_experience: number | null,
        is_verified: boolean,             // always true in this list
        has_notification_priority: boolean,
        avg_rating: number | null,        // parsed from numeric(5,2); null when no exams passed
        register_date: string,            // ISO-8601 — users.created_at (NOT NULL)
        last_login: string | null         // ISO-8601 — users.last_login_at; null until first login
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

### 2. Get a consultant profile by id

- **Endpoint:** `GET /admin/consultant-profiles/:id`
- **Method:** `GET`
- **Path params:** `id` (UUID v4) — validated by `ParseUUIDPipe`.
- **Behaviour:**
  - Same join shape as the list endpoint, but selects a single row.
  - Rejects soft-deleted rows with `404 CONSULTANT_PROFILE_NOT_FOUND`.
  - **Does NOT enforce** `is_verified = true` — admins frequently need to inspect a row mid-onboarding (the in-review consultant has a profile row but `is_verified = false` until the onboarding decision is `APPROVED`).
  - Loads the consultant's skills via [`ConsultantSkillsService.findByConsultantId`](../../../../src/modules/profiles/consultant/consultant-skills.service.ts) (one extra query — acceptable for an admin detail call).
  - Re-presigns `avatar_url` and `cv_url` in parallel via `UrlResolverService.resolve`.
- **Response 200:** [`IAdminConsultantProfileDetailResponse`](../../../../src/modules/profiles/consultant/dto/responses/interfaces/admin-consultant-profile-detail.response.interface.ts) — superset of the user-scoped [`IConsultantProfileResponse`](../../../../src/modules/profiles/consultant/dto/responses/interfaces/consultant-profile.response.interface.ts) plus admin-only columns and the joined user fields.

  Full shape:

  ```ts
  {
    // From consultant_profiles (matches user-scoped GET /consultant-profiles/me)
    id: string,
    user_id: string,
    full_name: string,
    bio: string | null,
    years_of_experience: number | null,
    avatar_url: string | null,           // presigned
    address_line: string | null,
    city: string | null,
    state_province: string | null,
    postal_code: string | null,
    country_code: string | null,
    phone_number: string | null,
    is_verified: boolean,
    account_balance: number,             // parsed from numeric(15,2)
    created_at: string,                  // ISO-8601 — profile creation
    skills: [
      {
        skill_id: string,
        proficiency_level: string | null,
        rating: string | null            // numeric(5,2) as string
      }
    ],
    // Admin-only columns (NOT on /consultant-profiles/me)
    cv_url: string | null,               // presigned
    stripe_connect_account_id: string | null,
    has_notification_priority: boolean,
    avg_rating: number | null,           // parsed from numeric(5,2)
    // Joined from users
    email: string,
    register_date: string,               // ISO-8601 — auth account creation
    last_login: string | null            // ISO-8601 — null until first login
  }
  ```

  > **Two timestamps:** `created_at` is the **profile**'s creation; `register_date` is the **user account**'s creation. They diverge whenever a user signs up before completing consultant onboarding.

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `CONSULTANT_PROFILE_NOT_FOUND` | Row missing or soft-deleted. |

## What's intentionally NOT in this controller

- **No flag setters.** Verification (`is_verified`) is toggled atomically by the onboarding _decide_ flow — see [POST /admin/onboardings/:id/decide](../consultant-onboarding/consultant-onboarding-api-specs.md). `has_notification_priority` is not exposed for write here; if product needs an admin toggle, add a separate `PATCH /admin/consultant-profiles/:id/notification-priority` mirroring the business admin's flag setters.
- **No skills mutation.** Skills are read-only on this surface. Consultant-driven skill changes go through `PATCH /consultant-profiles/me`; admin moderation, if any, would live in a separate skill-admin controller.

## Cross-links

- **Service:** [ConsultantProfilesAdminService](../../../../src/modules/profiles/consultant/consultant-profiles-admin.service.ts) — owns the QueryBuilder for the join, the `SORT_COLUMN_MAP` whitelist, and the URL resolution.
- **Repository accessor:** `uow.consultantProfiles` from [UnitOfWorkService](../../../../src/modules/unit-of-work/unit-of-work.service.ts).
- **User-scoped surface (separate controller):** [`ConsultantProfilesController`](../../../../src/modules/profiles/consultant/consultant-profiles.controller.ts) — the `/consultant-profiles/me` routes used by consultants (get/update own profile).
- **Onboarding admin surface:** [`consultant-onboarding-api-specs.md`](../consultant-onboarding/consultant-onboarding-api-specs.md) — where the approval decision is made; setting `status = APPROVED` is what surfaces a row into this list endpoint.
- **Pagination utilities:** [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts), [`PageDto`](../../../../src/common/dto/page.dto.ts), [`PageMetaDto`](../../../../src/common/dto/page-meta.dto.ts).
- **Admin controller convention precedent:** [`BusinessProfilesAdminController`](../../../../src/modules/profiles/business/business-profiles-admin.controller.ts) — same shape (`@Controller('admin/...')`, class-level `@Roles(UserRole.ADMIN_PLATFORM)`, no `@Platform`). See [business-profiles-admin-api-specs.md](../business-profiles/business-profiles-admin-api-specs.md).
