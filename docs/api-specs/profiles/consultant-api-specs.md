# ConsultantProfilesController — API Specs

> **Source:** [src/modules/profiles/consultant/consultant-profiles.controller.ts](../../../src/modules/profiles/consultant/consultant-profiles.controller.ts)
> **Base path:** `/consultant-profiles`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)`. Non-user or cross-platform callers receive `403`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Identity:** Caller identity (`userId`) is read from `RequestContextService` — never from a request param or body field.

> **Onboarding is separate.** The basic-info onboarding submission lives in [`docs/api-specs/consultant-onboarding/consultant.md`](../consultant-onboarding/consultant.md) (`POST /consultant/onboarding/profile`). This spec covers post-onboarding self-service routes only.

---

## Cross-cutting errors

| HTTP | error_code                 | When                                                                                         |
| ---- | -------------------------- | -------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`        | Missing or invalid Bearer token (global `JwtAuthGuard`).                                     |
| 403  | (forbidden, no error_code) | Caller is authenticated but not `UserRole.USER` or `active_platform ≠ consultant`.           |
| 422  | `GENERIC_VALIDATION_ERROR` | DTO shape failures (e.g. `country_code` not exactly 2 uppercase chars, `skill_id` not UUID). |

---

## Endpoints

### 1. Get own consultant profile

- **Endpoint:** `GET /consultant-profiles/me`
- **Method:** `GET`
- **Status on success:** `200 OK`
- **Behaviour:**
  - Reads `userId` from `RequestContextService` and returns the profile + the consultant's current skills (loaded in a separate query, see `ConsultantSkillsService.findByConsultantId`).
  - Throws `404 CONSULTANT_PROFILE_NOT_FOUND` if the caller has no profile yet.

- **Response 200:** [`ConsultantProfileResponseDto`](#consultant-profile-response-shape)

  ```json
  {
    "status_code": 200,
    "message": "OK",
    "error_code": null,
    "data": { "<ConsultantProfileResponse>" },
    "timestamp": "2026-05-14T12:00:00.000Z",
    "path": "/api/v1/consultant-profiles/me"
  }
  ```

- **Errors:**

  | HTTP | error_code                     | When                                  |
  | ---- | ------------------------------ | ------------------------------------- |
  | 404  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller has no consultant profile yet. |

---

### 2. Update own consultant profile

- **Endpoint:** `PATCH /consultant-profiles/me`
- **Method:** `PATCH`
- **Status on success:** `200 OK`
- **Request body:** [`UpdateConsultantProfileDto`](../../../src/modules/profiles/consultant/dto/requests/update-consultant-profile.dto.ts) — every field is optional.

  | Field                 | Type                     | Required | Constraints                                                                                 |
  | --------------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------- |
  | `full_name`           | `string`                 | no       | Max length 255.                                                                             |
  | `bio`                 | `string`                 | no       | —                                                                                           |
  | `years_of_experience` | `number`                 | no       | Integer ≥ 0.                                                                                |
  | `address_line`        | `string`                 | no       | —                                                                                           |
  | `city`                | `string`                 | no       | —                                                                                           |
  | `state_province`      | `string`                 | no       | —                                                                                           |
  | `postal_code`         | `string`                 | no       | —                                                                                           |
  | `country_code`        | `string`                 | no       | ISO 3166-1 alpha-2; exactly 2 chars, uppercase (if sent).                                   |
  | `phone_number`        | `string`                 | no       | —                                                                                           |
  | `skills`              | `[{ skill_id: string }]` | no       | Each `skill_id` must be a UUID. **Send empty array `[]` to clear, omit to keep unchanged.** |

  ```json
  {
    "full_name": "Jane Doe",
    "years_of_experience": 7,
    "city": "New York",
    "country_code": "US",
    "skills": [
      { "skill_id": "550e8400-e29b-41d4-a716-446655440000" },
      { "skill_id": "550e8400-e29b-41d4-a716-446655440001" }
    ]
  }
  ```

- **Behaviour:**
  - Only the fields present in the body are applied; omitted fields are left unchanged.
  - The entire write runs inside a single `UnitOfWork.withTransaction(...)` call.
  - **Skill replacement semantics:** when `skills` is provided, the consultant's full skill set is replaced atomically — every prior row in `consultant_skills` for this consultant is deleted and the new IDs are inserted with `proficiency_level = null` and `rating = null`. Those two are populated later by the per-skill exam pipeline; consultants cannot self-report them. Omitting `skills` from the body leaves the skill set untouched.
  - Reads `userId` from `RequestContextService`; the caller can only update their own profile.

- **Response 200:** [`ConsultantProfileResponseDto`](#consultant-profile-response-shape) — the full updated profile, with the (possibly replaced) skill list.

  ```json
  {
    "status_code": 200,
    "message": "OK",
    "error_code": null,
    "data": { "<ConsultantProfileResponse>" },
    "timestamp": "2026-05-14T12:00:00.000Z",
    "path": "/api/v1/consultant-profiles/me"
  }
  ```

- **Errors:**

  | HTTP | error_code                     | When                                        |
  | ---- | ------------------------------ | ------------------------------------------- |
  | 404  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller has no consultant profile to update. |
  | 422  | `GENERIC_VALIDATION_ERROR`     | Supplied fields fail DTO validation.        |

---

## Consultant Profile Response Shape

Returned by both endpoints as the `data` value inside the envelope.
Source: [`ConsultantProfileResponseDto`](../../../src/modules/profiles/consultant/dto/responses/consultant-profile-response.dto.ts)

```ts
{
  id: string,                     // UUID — consultant_profiles.id
  user_id: string,                // UUID — auth account
  full_name: string,
  bio: string | null,
  years_of_experience: number | null,
  avatar_url: string | null,
  address_line: string | null,
  city: string | null,
  state_province: string | null,
  postal_code: string | null,
  country_code: string | null,    // ISO 3166-1 alpha-2
  phone_number: string | null,
  is_verified: boolean,           // toggled by admin via the consultant-onboarding review flow
  account_balance: number,        // 2 decimal places; parsed from numeric DB column
  created_at: string,             // ISO-8601 — profile creation timestamp
  skills: Array<{
    skill_id: string,             // UUID
    proficiency_level: string | null,  // assigned by skill-exam pipeline; null until first pass
    rating: number | null              // numeric(5,2); skill-exam score percentage
  }>
}
```

> **Read-only fields:** `is_verified` is owned by the consultant-onboarding admin review flow. `avatar_url` and `cv_url` are managed by the `/files` upload pipeline. `proficiency_level` and `rating` are written by the per-skill exam pipeline — never by this endpoint.

---

## Cross-links

- **Onboarding (separate module):** [`POST /consultant/onboarding/profile`](../consultant-onboarding/consultant.md) — submits the first-time consultant profile + transitions onboarding to `IN_INTERVIEW`.
- **Service:** [ConsultantProfilesService](../../../src/modules/profiles/consultant/consultant-profiles.service.ts) — owns profile fetch + partial update (transactional skill-set replace).
- **Repository accessor:** `uow.consultantProfiles` and `uow.consultantSkills` from [UnitOfWorkService](../../../src/modules/unit-of-work/unit-of-work.service.ts).
- **Entity:** [ConsultantProfile](../../../src/database/entities/profiles/consultant-profile.entity.ts) — one profile per user; `uq_consultant_profiles_user_id` enforces uniqueness at the DB level.
