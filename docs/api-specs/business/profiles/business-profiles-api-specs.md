# BusinessProfilesController — API Specs

> **Source:** [src/modules/profiles/business/business-profiles.controller.ts](../../../../src/modules/profiles/business/business-profiles.controller.ts)
> **Base path:** `/business-profiles`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`. Non-user or cross-platform callers receive `403`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Identity:** Caller identity (`userId`, `activePlatform`) is read from `RequestContextService` — never from a request param or body field.

> **Onboarding moved.** The initial onboarding submission (`POST /business/onboarding/profile`) now lives in its own module and is documented in [`../onboarding/onboarding-api-specs.md`](../onboarding/onboarding-api-specs.md). This file covers the post-onboarding self-service routes only.

---

## Cross-cutting errors

| HTTP | error_code                 | When                                                                                                  |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`        | Missing or invalid Bearer token (global `JwtAuthGuard`).                                              |
| 403  | (forbidden, no error_code) | Caller is authenticated but not `UserRole.USER` or `active_platform ≠ business`.                      |
| 422  | `GENERIC_VALIDATION_ERROR` | DTO shape failures (e.g. `country_code` not exactly 2 uppercase chars, `tax_id` outside constraints). |

---

## Endpoints

### 1. Get own business profile

- **Endpoint:** `GET /business-profiles/me`
- **Method:** `GET`
- **Status on success:** `200 OK`
- **Behaviour:**
  - Reads `userId` from `RequestContextService` and returns the profile belonging to the caller.
  - Throws `404 BUSINESS_PROFILE_NOT_FOUND` if the caller has not completed onboarding yet.

- **Response 200:** [`BusinessProfileResponseDto`](#business-profile-response-shape)

  ```json
  {
    "status_code": 200,
    "message": "OK",
    "error_code": null,
    "data": { "<BusinessProfileResponse>" },
    "timestamp": "2026-05-14T12:00:00.000Z",
    "path": "/api/v1/business-profiles/me"
  }
  ```

- **Errors:**

  | HTTP | error_code                   | When                                |
  | ---- | ---------------------------- | ----------------------------------- |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND` | Caller has no business profile yet. |

---

### 2. Update own business profile

- **Endpoint:** `PATCH /business-profiles/me`
- **Method:** `PATCH`
- **Status on success:** `200 OK`
- **Request body:** [`UpdateBusinessProfileDto`](../../../../src/modules/profiles/business/dto/requests/update-business-profile.dto.ts) — every field is optional.

  | Field            | Type     | Required | Constraints                                                                  |
  | ---------------- | -------- | -------- | ---------------------------------------------------------------------------- |
  | `company_name`   | `string` | no       | —                                                                            |
  | `owner_name`     | `string` | no       | Full name of the business owner.                                             |
  | `tax_id`         | `string` | no       | Length 5–32; regex `^[A-Z0-9-]+$` (case-insensitive). Uniqueness rule below. |
  | `industry`       | `string` | no       | —                                                                            |
  | `company_size`   | `string` | no       | —                                                                            |
  | `address_line`   | `string` | no       | —                                                                            |
  | `city`           | `string` | no       | —                                                                            |
  | `state_province` | `string` | no       | —                                                                            |
  | `postal_code`    | `string` | no       | —                                                                            |
  | `country_code`   | `string` | no       | ISO 3166-1 alpha-2; exactly 2 chars, uppercase (if sent).                    |
  | `phone_number`   | `string` | no       | —                                                                            |

  ```json
  {
    "tax_id": "9876543210",
    "city": "New York",
    "phone_number": "+12125552671"
  }
  ```

- **Behaviour:**
  - Only the fields present in the body are applied; omitted fields are left unchanged.
  - Reads `userId` and `activePlatform` from `RequestContextService`; the caller can only update their own profile.
  - **Tax-ID uniqueness on update:** when `tax_id` is provided AND differs from the stored value, the same conflict check used during onboarding runs against `(new tax_id, profile.country_code)` on the caller's platform. The caller's own profile is excluded so a no-op or addressless-edit passes. If the profile has no `country_code` yet, the request is rejected as a conflict (use onboarding first, or send `country_code` and `tax_id` together).
  - Throws `404 BUSINESS_PROFILE_NOT_FOUND` if no profile exists for the caller.

- **Response 200:** [`BusinessProfileResponseDto`](#business-profile-response-shape) — the full updated profile.

  ```json
  {
    "status_code": 200,
    "message": "OK",
    "error_code": null,
    "data": { "<BusinessProfileResponse>" },
    "timestamp": "2026-05-14T12:00:00.000Z",
    "path": "/api/v1/business-profiles/me"
  }
  ```

- **Errors:**

  | HTTP | error_code                               | When                                                                                    |
  | ---- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND`             | Caller has no business profile to update.                                               |
  | 409  | `BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS` | New `(tax_id, country_code)` collides with another active account on the same platform. |
  | 422  | `GENERIC_VALIDATION_ERROR`               | Supplied fields fail DTO validation.                                                    |

---

## Business Profile Response Shape

Returned by both endpoints (and by [`POST /business/onboarding/profile`](../onboarding/onboarding-api-specs.md)) as the `data` value inside the envelope.
Source: [`BusinessProfileResponseDto`](../../../../src/modules/profiles/business/dto/responses/business-profile-response.dto.ts)

```ts
{
  id: string,                     // UUID — business_profiles.id
  user_id: string,                // UUID — auth account (business_profiles.user_id)
  company_name: string,
  owner_name: string | null,      // null for legacy profiles created before owner_name was introduced
  tax_id: string | null,          // null for legacy profiles created before tax_id was introduced
  industry: string | null,
  company_size: string | null,
  website_url: string | null,
  description: string | null,
  address_line: string | null,
  city: string | null,
  state_province: string | null,
  postal_code: string | null,
  country_code: string | null,    // ISO 3166-1 alpha-2
  phone_number: string | null,
  logo_url: string | null,
  is_verified: boolean,           // set to true on onboarding; can also be toggled by admin
  is_partner_platform: boolean,   // set by admin only; always false after onboarding
  allow_payment_credit: boolean,  // set by admin only; always false after onboarding
  account_balance: number,        // 2 decimal places; parsed from numeric DB column
  created_at: string              // ISO-8601 — profile creation timestamp
}
```

> **Read-only flags:** `is_verified`, `is_partner_platform`, and `allow_payment_credit` can only be toggled by an admin via [`BusinessProfilesAdminController`](../../../../src/modules/profiles/business/business-profiles-admin.controller.ts). They are surfaced here as read-only context for the business owner.

---

## Cross-links

- **Onboarding (separate module):** [`POST /business/onboarding/profile`](../onboarding/onboarding-api-specs.md) — initial submission of company details + `tax_id`.
- **Service:** [BusinessProfilesService](../../../../src/modules/profiles/business/business-profiles.service.ts) — owns profile fetch + partial update logic (incl. tax-id conflict check on update).
- **Repository accessor:** `uow.businessProfiles` from [UnitOfWorkService](../../../../src/modules/unit-of-work/unit-of-work.service.ts).
- **Admin surface (separate controller):** [BusinessProfilesAdminController](../../../../src/modules/profiles/business/business-profiles-admin.controller.ts) — admin-only list, detail, and flag-toggle routes.
- **Entity:** [BusinessProfile](../../../../src/database/entities/profiles/business-profile.entity.ts) — one profile stub is created per user at registration time; `uq_business_profiles_user_id` enforces user uniqueness at the DB level; `tax_id` uniqueness is per-platform + country, enforced in the app layer.
