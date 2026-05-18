# BusinessOnboardingController — API Specs

> **Source:** [src/modules/business-onboarding/controllers/business-onboarding.controller.ts](../../../../src/modules/business-onboarding/controllers/business-onboarding.controller.ts)
> **Base path:** `/api/v1/business/onboarding`
> **Scope (applies to every endpoint):** `@ApiBearerAuth`, `RolesGuard`, `PlatformGuard`, `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`. Non-`USER` or non-`business` callers receive `403 GENERIC_FORBIDDEN`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Identity:** Caller identity (`userId`, `activePlatform`) is read from `RequestContextService` — never from a request param or body field.

## Throttling

The whole controller sits under `@Throttle(THROTTLE_MODERATE)` — **10 req / 60 s** per IP. Exceeding the limit returns `429 AUTH_RATE_LIMITED`.

---

## Cross-cutting errors

| HTTP | `error_code`                | When                                                                                                                                                 |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`      | Missing or invalid Bearer token (global `JwtAuthGuard`).                                                                                             |
| 403  | `GENERIC_FORBIDDEN`         | Caller is authenticated but not `UserRole.USER` (RolesGuard) or `active_platform ≠ business` (PlatformGuard).                                        |
| 422  | `GENERIC_VALIDATION_FAILED` | DTO shape failures (e.g. missing required field, `country_code` not exactly 2 uppercase chars, `tax_id` outside the 5–32 chars / `[A-Z0-9-]` regex). |
| 429  | `AUTH_RATE_LIMITED`         | Controller-level throttle exceeded (10 req / 60 s).                                                                                                  |

---

## Endpoints

### 1. Submit business onboarding profile

- **Endpoint:** `POST /api/v1/business/onboarding/profile`
- **Method:** `POST`
- **Throttle:** `MODERATE` (10 / 60 s)
- **Status on success:** `201 Created`
- **Request body:** [`OnboardBusinessProfileDto`](../../../../src/modules/business-onboarding/dto/requests/onboard-business-profile.dto.ts)

  | Field            | Type     | Required | Constraints                                                                       |
  | ---------------- | -------- | -------- | --------------------------------------------------------------------------------- |
  | `company_name`   | `string` | **yes**  | `@IsString()` — empty string passes validation, prefer a sensible client-side min |
  | `owner_name`     | `string` | **yes**  | `@IsString() @IsNotEmpty()` — full name of the business owner                     |
  | `tax_id`         | `string` | **yes**  | Length 5–32; regex `^[A-Z0-9-]+$` (case-insensitive). Uniqueness rule below.      |
  | `industry`       | `string` | **yes**  | `@IsString()`                                                                     |
  | `company_size`   | `string` | **yes**  | `@IsString()` (e.g. `"1-10"`, `"11-50"`, `"51-200"`)                              |
  | `address_line`   | `string` | **yes**  | `@IsString()`                                                                     |
  | `city`           | `string` | **yes**  | `@IsString()`                                                                     |
  | `state_province` | `string` | **yes**  | `@IsString()`                                                                     |
  | `postal_code`    | `string` | **yes**  | `@IsString()`                                                                     |
  | `country_code`   | `string` | **yes**  | ISO 3166-1 alpha-2; exactly 2 chars, uppercase (`@Length(2,2) @IsUppercase()`).   |
  | `phone_number`   | `string` | **yes**  | `@IsString()`                                                                     |

  ```json
  {
    "company_name": "Acme Corp",
    "owner_name": "John Doe",
    "tax_id": "1234567890",
    "industry": "Technology",
    "company_size": "11-50",
    "address_line": "123 Main St",
    "city": "San Francisco",
    "state_province": "California",
    "postal_code": "94105",
    "country_code": "US",
    "phone_number": "+14155552671"
  }
  ```

- **Behaviour:**
  - A profile stub is created automatically at registration. This endpoint **overwrites** the stub with company details and `tax_id`, then sets `is_verified = true`.
  - Reads `userId` and `activePlatform` from `RequestContextService`; the caller can only onboard their own profile.
  - **Tax-ID uniqueness:** `(tax_id, country_code)` must not collide with any other **active** account on the same platform. The lookup ignores soft-deleted profiles, inactive users (`is_active = false`), and banned users (`banned_at IS NOT NULL`).
  - **Re-submission is allowed.** The conflict check passes `excludeUserId = caller.userId`, so a business that already submitted can call the endpoint again to change their company details (including `tax_id`) — the previous values are overwritten. `is_verified` remains `true` on every successful call.
  - Throws `404 BUSINESS_PROFILE_NOT_FOUND` if no stub exists (user has not completed registration).
  - **Side effect — admin fan-out:** on success the service emits `business.onboarded` (`NOTIFICATION_EVENTS.BUSINESS_ONBOARDED`) with `{ business_user_id, business_id, business_name }`. The notifications module catches it and dispatches an `admin_business_onboarded` notification to every active admin (see [admin events catalog](../../admin/notifications/notifications-admin-events-api-specs.md)). The event fires on **every** successful call, including re-submissions — admin notifications may double up if the same business onboards twice in quick succession.

- **Response 201:** [`BusinessProfileResponseDto`](../profiles/business-profiles-api-specs.md#business-profile-response-shape) — the freshly saved profile (`is_verified: true`, `tax_id` present, all submitted fields populated).

  ```json
  {
    "status_code": 201,
    "message": "Created",
    "error_code": null,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "550e8400-e29b-41d4-a716-446655440010",
      "company_name": "Acme Corp",
      "owner_name": "John Doe",
      "tax_id": "1234567890",
      "industry": "Technology",
      "company_size": "11-50",
      "address_line": "123 Main St",
      "city": "San Francisco",
      "state_province": "California",
      "postal_code": "94105",
      "country_code": "US",
      "phone_number": "+14155552671",
      "logo_url": null,
      "is_verified": true,
      "is_partner_platform": false,
      "allow_payment_credit": false,
      "account_balance": 0.0,
      "created_at": "2026-05-14T12:00:00.000Z"
    },
    "timestamp": "2026-05-14T12:00:00.000Z",
    "path": "/api/v1/business/onboarding/profile"
  }
  ```

- **Errors:**

  | HTTP | `error_code`                             | When                                                                                             |
  | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND`             | No profile stub found — user has not completed registration.                                     |
  | 409  | `BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS` | Another **active** account on this platform already owns the same `(tax_id, country_code)` pair. |
  | 422  | `GENERIC_VALIDATION_FAILED`              | Body fails DTO validation (see constraints table above).                                         |
  | 429  | `AUTH_RATE_LIMITED`                      | Controller throttle exceeded.                                                                    |

---

## Cross-links

- **Service:** [BusinessOnboardingService](../../../../src/modules/business-onboarding/services/business-onboarding.service.ts) — owns the onboarding step plus the per-platform tax-id conflict check.
- **Repository helper:** `uow.businessProfiles.existsTaxIdConflict({ taxId, countryCode, platform, excludeUserId? })` in [BusinessProfileRepository](../../../../src/modules/unit-of-work/repositories/profiles/business-profile.repository.ts) — joins `business_profiles → users` and filters by `users.platform`, `users.is_active`, `users.banned_at IS NULL`.
- **Self-service profile management:** [`/business-profiles/me`](../profiles/business-profiles-api-specs.md) — get + partial update (including `tax_id`, with the same uniqueness check).
- **Entity:** [BusinessProfile](../../../../src/database/entities/profiles/business-profile.entity.ts) — `tax_id` is `VARCHAR(32) NULL`; lookup-only index `idx_business_profiles_tax_id_country`.
- **Downstream notification:** `admin_business_onboarded` — see [admin events catalog](../../admin/notifications/notifications-admin-events-api-specs.md) for the metadata shape + admin-side redirect URL.
