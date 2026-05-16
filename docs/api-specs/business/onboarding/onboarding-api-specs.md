# BusinessOnboardingController — API Specs

> **Source:** [src/modules/business-onboarding/controllers/business-onboarding.controller.ts](../../../../src/modules/business-onboarding/controllers/business-onboarding.controller.ts)
> **Base path:** `/business/onboarding`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`. Non-user or cross-platform callers receive `403`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Identity:** Caller identity (`userId`, `activePlatform`) is read from `RequestContextService` — never from a request param or body field.

---

## Cross-cutting errors

| HTTP | error_code                 | When                                                                                                                                                 |
| ---- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`        | Missing or invalid Bearer token (global `JwtAuthGuard`).                                                                                             |
| 403  | (forbidden, no error_code) | Caller is authenticated but not `UserRole.USER` or `active_platform ≠ business`.                                                                     |
| 422  | `GENERIC_VALIDATION_ERROR` | DTO shape failures (e.g. missing required field, `country_code` not exactly 2 uppercase chars, `tax_id` outside the 5–32 chars / `[A-Z0-9-]` regex). |

---

## Endpoints

### 1. Submit business onboarding profile

- **Endpoint:** `POST /business/onboarding/profile`
- **Method:** `POST`
- **Status on success:** `201 Created`
- **Request body:** [`OnboardBusinessProfileDto`](../../../../src/modules/business-onboarding/dto/requests/onboard-business-profile.dto.ts)

  | Field            | Type     | Required | Constraints                                                                  |
  | ---------------- | -------- | -------- | ---------------------------------------------------------------------------- |
  | `company_name`   | `string` | **yes**  | —                                                                            |
  | `owner_name`     | `string` | **yes**  | Full name of the business owner.                                             |
  | `tax_id`         | `string` | **yes**  | Length 5–32; regex `^[A-Z0-9-]+$` (case-insensitive). Uniqueness rule below. |
  | `industry`       | `string` | **yes**  | —                                                                            |
  | `company_size`   | `string` | **yes**  | —                                                                            |
  | `address_line`   | `string` | **yes**  | —                                                                            |
  | `city`           | `string` | **yes**  | —                                                                            |
  | `state_province` | `string` | **yes**  | —                                                                            |
  | `postal_code`    | `string` | **yes**  | —                                                                            |
  | `country_code`   | `string` | **yes**  | ISO 3166-1 alpha-2; exactly 2 chars, uppercase.                              |
  | `phone_number`   | `string` | **yes**  | —                                                                            |

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
  - A profile stub is created automatically at registration. This endpoint populates the stub with company details and `tax_id`, then sets `is_verified = true`.
  - Reads `userId` and `activePlatform` from `RequestContextService`; the caller can only onboard their own profile.
  - **Tax-ID uniqueness:** `(tax_id, country_code)` must not collide with any other **active** account on the same platform. The lookup ignores soft-deleted profiles, inactive users (`is_active = false`), and banned users (`banned_at IS NOT NULL`).
  - Emits the `business.onboarded` event so downstream listeners (notifications, analytics) react.
  - Throws `404 BUSINESS_PROFILE_NOT_FOUND` if no stub exists (user has not completed registration).

- **Response 201:** [`BusinessProfileResponseDto`](../profiles/business-profiles-api-specs.md#business-profile-response-shape) — see the profiles spec for the canonical shape (now includes `tax_id`).

  ```json
  {
    "status_code": 201,
    "message": "Created",
    "error_code": null,
    "data": { "<BusinessProfileResponse>" },
    "timestamp": "2026-05-14T12:00:00.000Z",
    "path": "/api/v1/business/onboarding/profile"
  }
  ```

- **Errors:**

  | HTTP | error_code                               | When                                                                                             |
  | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND`             | No profile stub found — user has not completed registration.                                     |
  | 409  | `BUSINESS_PROFILE_TAX_ID_ALREADY_EXISTS` | Another **active** account on this platform already owns the same `(tax_id, country_code)` pair. |
  | 422  | `GENERIC_VALIDATION_ERROR`               | Body fails DTO validation (see constraints table above).                                         |

---

## Cross-links

- **Service:** [BusinessOnboardingService](../../../../src/modules/business-onboarding/services/business-onboarding.service.ts) — owns the onboarding step plus the per-platform tax-id conflict check.
- **Repository helper:** `uow.businessProfiles.existsTaxIdConflict({ taxId, countryCode, platform, excludeUserId? })` in [BusinessProfileRepository](../../../../src/modules/unit-of-work/repositories/profiles/business-profile.repository.ts) — joins `business_profiles → users` and filters by `users.platform`, `users.is_active`, `users.banned_at IS NULL`.
- **Self-service profile management:** [`/business-profiles/me`](../profiles/business-profiles-api-specs.md) — get + partial update (including `tax_id`, with the same uniqueness check).
- **Entity:** [BusinessProfile](../../../../src/database/entities/profiles/business-profile.entity.ts) — `tax_id` is `VARCHAR(32) NULL`; lookup-only index `idx_business_profiles_tax_id_country`.
