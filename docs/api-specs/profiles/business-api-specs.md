# BusinessProfilesController — API Specs

> **Source:** [src/modules/profiles/business/business-profiles.controller.ts](../../../src/modules/profiles/business/business-profiles.controller.ts)
> **Base path:** `/business-profiles`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`. Non-user or cross-platform callers receive `403`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Identity:** Caller identity (userId) is read from `RequestContextService` — never from a request param or body field.

---

## Cross-cutting errors

| HTTP | error_code                 | When                                                                                        |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`        | Missing or invalid Bearer token (global `JwtAuthGuard`).                                    |
| 403  | (forbidden, no error_code) | Caller is authenticated but not `UserRole.USER` or `active_platform ≠ business`.            |
| 422  | `GENERIC_VALIDATION_ERROR` | DTO shape failures (missing required fields, `country_code` not exactly 2 uppercase chars). |

---

## Endpoints

### 1. Onboard business profile

- **Endpoint:** `POST /business-profiles/onboard`
- **Method:** `POST`
- **Status on success:** `201 Created`
- **Request body:** [`OnboardBusinessProfileDto`](../../../src/modules/profiles/business/dto/requests/onboard-business-profile.dto.ts)

  | Field            | Type     | Required | Constraints                                     |
  | ---------------- | -------- | -------- | ----------------------------------------------- |
  | `company_name`   | `string` | **yes**  | —                                               |
  | `industry`       | `string` | **yes**  | —                                               |
  | `company_size`   | `string` | **yes**  | —                                               |
  | `address_line`   | `string` | **yes**  | —                                               |
  | `city`           | `string` | **yes**  | —                                               |
  | `state_province` | `string` | **yes**  | —                                               |
  | `postal_code`    | `string` | **yes**  | —                                               |
  | `country_code`   | `string` | **yes**  | ISO 3166-1 alpha-2; exactly 2 chars, uppercase. |
  | `phone_number`   | `string` | **yes**  | —                                               |

  ```json
  {
    "company_name": "Acme Corp",
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
  - A profile stub is created automatically at registration. This endpoint populates the stub with company details and sets `is_verified = true`.
  - Reads `userId` from `RequestContextService`; the caller can only onboard their own profile.
  - Throws `404 BUSINESS_PROFILE_NOT_FOUND` if no stub exists for the caller (user has not completed registration).

- **Response 201:** [`BusinessProfileResponseDto`](#business-profile-response-shape)

  ```json
  {
    "status_code": 201,
    "message": "Created",
    "error_code": null,
    "data": { "<BusinessProfileResponse>" },
    "timestamp": "2026-05-09T12:00:00.000Z",
    "path": "/api/v1/business-profiles/onboard"
  }
  ```

- **Errors:**

  | HTTP | error_code                   | When                                                         |
  | ---- | ---------------------------- | ------------------------------------------------------------ |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND` | No profile stub found — user has not completed registration. |
  | 422  | `GENERIC_VALIDATION_ERROR`   | Body fails DTO validation (see table above).                 |

---

### 2. Get own business profile

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
    "timestamp": "2026-05-09T12:00:00.000Z",
    "path": "/api/v1/business-profiles/me"
  }
  ```

- **Errors:**

  | HTTP | error_code                   | When                                |
  | ---- | ---------------------------- | ----------------------------------- |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND` | Caller has no business profile yet. |

---

### 3. Update own business profile

- **Endpoint:** `PATCH /business-profiles/me`
- **Method:** `PATCH`
- **Status on success:** `200 OK`
- **Request body:** [`UpdateBusinessProfileDto`](../../../src/modules/profiles/business/dto/requests/update-business-profile.dto.ts) — `PartialType(OnboardBusinessProfileDto)`; all fields are optional.

  | Field            | Type     | Required | Constraints                                               |
  | ---------------- | -------- | -------- | --------------------------------------------------------- |
  | `company_name`   | `string` | no       | —                                                         |
  | `industry`       | `string` | no       | —                                                         |
  | `company_size`   | `string` | no       | —                                                         |
  | `address_line`   | `string` | no       | —                                                         |
  | `city`           | `string` | no       | —                                                         |
  | `state_province` | `string` | no       | —                                                         |
  | `postal_code`    | `string` | no       | —                                                         |
  | `country_code`   | `string` | no       | ISO 3166-1 alpha-2; exactly 2 chars, uppercase (if sent). |
  | `phone_number`   | `string` | no       | —                                                         |

  ```json
  {
    "city": "New York",
    "phone_number": "+12125552671"
  }
  ```

- **Behaviour:**
  - Only the fields present in the body are applied; omitted fields are left unchanged.
  - Reads `userId` from `RequestContextService`; the caller can only update their own profile.
  - Throws `404 BUSINESS_PROFILE_NOT_FOUND` if no profile exists for the caller.

- **Response 200:** [`BusinessProfileResponseDto`](#business-profile-response-shape) — the full updated profile.

  ```json
  {
    "status_code": 200,
    "message": "OK",
    "error_code": null,
    "data": { "<BusinessProfileResponse>" },
    "timestamp": "2026-05-09T12:00:00.000Z",
    "path": "/api/v1/business-profiles/me"
  }
  ```

- **Errors:**

  | HTTP | error_code                   | When                                      |
  | ---- | ---------------------------- | ----------------------------------------- |
  | 404  | `BUSINESS_PROFILE_NOT_FOUND` | Caller has no business profile to update. |
  | 422  | `GENERIC_VALIDATION_ERROR`   | Supplied fields fail DTO validation.      |

---

## Business Profile Response Shape

Returned by all three endpoints as the `data` value inside the envelope.
Source: [`BusinessProfileResponseDto`](../../../src/modules/profiles/business/dto/responses/business-profile-response.dto.ts)

```ts
{
  id: string,                     // UUID — business_profiles.id
  user_id: string,                // UUID — auth account (business_profiles.user_id)
  company_name: string,
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

> **Read-only flags:** `is_verified`, `is_partner_platform`, and `allow_payment_credit` can only be toggled by an admin via [`BusinessProfilesAdminController`](../../../src/modules/profiles/business/business-profiles-admin.controller.ts). They are surfaced here as read-only context for the business owner.

---

## Cross-links

- **Service:** [BusinessProfilesService](../../../src/modules/profiles/business/business-profiles.service.ts) — owns onboarding, profile fetch, and partial update logic.
- **Repository accessor:** `uow.businessProfiles` from [UnitOfWorkService](../../../src/modules/unit-of-work/unit-of-work.service.ts).
- **Admin surface (separate controller):** [BusinessProfilesAdminController](../../../src/modules/profiles/business/business-profiles-admin.controller.ts) — admin-only list, detail, and flag-toggle routes.
- **Entity:** [BusinessProfile](../../../src/database/entities/profiles/business-profile.entity.ts) — one profile stub is created per user at registration time; `uq_business_profiles_user_id` enforces the uniqueness at the DB level.
