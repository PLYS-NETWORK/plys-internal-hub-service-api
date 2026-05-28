# Consultant Onboarding — Admin review endpoints

> **Source:**
> [apps/internal-admin-service/src/modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller.ts](../../../../apps/internal-admin-service/src/modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller.ts)
> **Base path:** `/api/v1/admin/onboardings`
> **Scope (applies to every endpoint):** `@ApiBearerAuth()`, `RolesGuard`, `@Roles(UserRole.ADMIN_PLATFORM)`.
> **Field-name convention:** request/response payloads use **snake_case**.

## Throttling

The controller defaults to `@Throttle(THROTTLE_DEFAULT)` (60 req / 60 s) and `decide` overrides with `@Throttle(THROTTLE_STRICT)` (5 req / 60 s):

| Endpoint            | Tier      | Limit     |
| ------------------- | --------- | --------- |
| `GET /` (list)      | `DEFAULT` | 60 / 60 s |
| `GET /:id` (detail) | `DEFAULT` | 60 / 60 s |
| `POST /:id/decide`  | `STRICT`  | 5 / 60 s  |

Exceeding the limit returns `429 AUTH_RATE_LIMITED`.

## Cross-cutting errors

| HTTP | `error_code`                           | When                                                                   |
| ---- | -------------------------------------- | ---------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`                 | Missing or invalid Bearer access token.                                |
| 403  | `GENERIC_FORBIDDEN`                    | Token's role is not `ADMIN_PLATFORM`.                                  |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`      | Onboarding id does not exist.                                          |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | `decide` called on an onboarding that is not in `INTERVIEW_SUBMITTED`. |
| 422  | `GENERIC_VALIDATION_FAILED`            | DTO failed validation (UUIDs, enum values, length limits).             |
| 429  | `AUTH_RATE_LIMITED`                    | Endpoint-specific throttle exceeded.                                   |

---

## Endpoints

### 1. List onboardings (paginated)

- **Endpoint:** `GET /admin/onboardings`
- **Throttle:** `DEFAULT` (60 / 60 s)
- **Query params:** [`ListOnboardingsDto`](../../../../apps/internal-admin-service/src/modules/admin-consultant-onboarding/dto/requests/list-onboardings.dto.ts)

  | Field     | Type   | Required | Notes                                                                                                                                                                   |
  | --------- | ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `status`  | enum   | no       | One of `PENDING_BASIC_INFO`, `IN_INTERVIEW`, `INTERVIEW_SUBMITTED`, `APPROVED`, `REJECTED`. When omitted, defaults to `INTERVIEW_SUBMITTED` (the pending-review queue). |
  | `user_id` | uuid   | no       | Filter to a single consultant.                                                                                                                                          |
  | `page`    | int ≥1 | no       | Default `1`.                                                                                                                                                            |
  | `take`    | int    | no       | Default `20`, min `1`, max `100`.                                                                                                                                       |

- **Response 200:** `PaginatedOnboardingsResponseDto`

  ```json
  {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "0f3b9d24-...-aa01",
        "consultant_email": "jane@example.com",
        "consultant_name": "Jane Doe",
        "status": "INTERVIEW_SUBMITTED",
        "decision": null,
        "profile_submitted_at": "2026-05-12T10:11:00.000Z",
        "interview_submitted_at": "2026-05-13T09:00:00.000Z",
        "reviewed_at": null,
        "created_at": "2026-05-10T08:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "take": 20,
      "item_count": 7,
      "page_count": 1,
      "has_previous_page": false,
      "has_next_page": false
    }
  }
  ```

- **Errors:** cross-cutting only.

---

### 2. Get onboarding detail

Full onboarding view including basic profile fields and the consultant's answers. Every answer carries a **frozen `question_snapshot`** (taken at submission time) so editing or soft-deleting the underlying onboarding question later does not change what the admin sees here.

**Avatar / CV URL — fresh on every call.** `avatar_url` and `cv_url` are re-signed by the server every time this endpoint runs:

- The consultant's frontend uploads the avatar/CV via `POST /files`, which returns a presigned GET URL signed with a 15-minute TTL (`X-Amz-Expires=900`).
- That upload-time URL is persisted onto `consultant_profiles.avatar_url` / `cv_url` verbatim, so by the time an admin reviews the row (often hours/days later) the signed URL has expired and the image renders broken.
- To work around that, the admin detail endpoint extracts the S3 object key from the stored URL, calls `IStorageProvider.getUrl(key)`, and returns a freshly signed URL valid for the configured presign TTL (`AWS_S3_PRESIGN_TTL_SECONDS`, default 15 minutes).
- If the stored value is **not** a recognisable S3 URL (e.g. local provider, public CDN), it is returned unchanged.

Clients should therefore treat both URLs as **short-lived** and request the detail endpoint again instead of caching them.

- **Endpoint:** `GET /admin/onboardings/:id`
- **Throttle:** `DEFAULT` (60 / 60 s)
- **Path params:** `id` (UUID — validated by `ParseUUIDPipe`) — the onboarding id.
- **Response 200:** [`OnboardingDetailResponseDto`](../../../../apps/internal-admin-service/src/modules/admin-consultant-onboarding/dto/responses/onboarding-detail-response.dto.ts)

  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "0f3b9d24-...-aa01",
    "consultant_email": "jane@example.com",
    "consultant_name": "Jane Doe",
    "bio": "Senior full-stack engineer with 7 years building SaaS products.",
    "years_of_experience": 7,
    "phone_number": "+905551234567",
    "country_code": "TR",
    "avatar_url": "https://nbg1.your-objectstorage.com/ployos-storage/development/avatars/development/2026/05/6b6e7d10-680a-4fc5-9e14-79ca05a3c8bc.jpg?X-Amz-Algorithm=...&X-Amz-Expires=900&X-Amz-Signature=...",
    "cv_url": "https://nbg1.your-objectstorage.com/ployos-storage/development/consultant-CVs/development/2026/05/abc.pdf?X-Amz-Algorithm=...&X-Amz-Expires=900&X-Amz-Signature=...",
    "status": "INTERVIEW_SUBMITTED",
    "decision": null,
    "rejection_note": null,
    "blocked_until": null,
    "profile_submitted_at": "2026-05-12T10:11:00.000Z",
    "interview_submitted_at": "2026-05-13T09:00:00.000Z",
    "reviewed_at": null,
    "reviewed_by": null,
    "created_at": "2026-05-10T08:00:00.000Z",
    "answers": [
      {
        "id": "01H8F1...",
        "onboarding_question_id": "01H8E5...",
        "question_snapshot": {
          "type": "TEXT",
          "question": "Describe your most recent SaaS project.",
          "options": null
        },
        "answer_value": { "text": "I led the migration of a hospitality SaaS..." },
        "submitted_at": "2026-05-13T09:00:00.000Z"
      },
      {
        "id": "01H8F2...",
        "onboarding_question_id": "01H8E6...",
        "question_snapshot": {
          "type": "RADIO",
          "question": "Do you have prior remote-work experience?",
          "options": [
            { "value": "opt_yes_2y", "label": "Yes, more than 2 years" },
            { "value": "opt_yes_under_2", "label": "Yes, less than 2 years" },
            { "value": "opt_no", "label": "No" }
          ]
        },
        "answer_value": { "value": "opt_yes_2y" },
        "submitted_at": "2026-05-13T09:00:00.000Z"
      },
      {
        "id": "01H8F3...",
        "onboarding_question_id": "01H8E7...",
        "question_snapshot": {
          "type": "CHECKBOX",
          "question": "Which of the following are part of your daily stack?",
          "options": [
            { "value": "ts", "label": "TypeScript" },
            { "value": "node", "label": "Node.js" },
            { "value": "postgres", "label": "PostgreSQL" },
            { "value": "k8s", "label": "Kubernetes" }
          ]
        },
        "answer_value": { "values": ["ts", "node", "postgres"] },
        "submitted_at": "2026-05-13T09:00:00.000Z"
      }
    ]
  }
  ```

- **Errors:**

  | HTTP | `error_code`                      | When                          |
  | ---- | --------------------------------- | ----------------------------- |
  | 404  | `CONSULTANT_ONBOARDING_NOT_FOUND` | Onboarding id does not exist. |

---

### 3. Decide on the onboarding (APPROVE / REJECT)

- **Endpoint:** `POST /admin/onboardings/:id/decide`
- **Throttle:** `STRICT` (5 / 60 s)
- **Path params:** `id` (UUID — validated by `ParseUUIDPipe`)
- **Body:** [`OnboardingDecisionDto`](../../../../apps/internal-admin-service/src/modules/admin-consultant-onboarding/dto/requests/onboarding-decision.dto.ts)

  Approve:

  ```json
  {
    "decision": "APPROVED",
    "rejection_note": null
  }
  ```

  Reject (note can be plain text; up to 2000 chars):

  ```json
  {
    "decision": "REJECTED",
    "rejection_note": "Answers were too shallow — please re-apply with more concrete examples."
  }
  ```

- **Response 200:** the refreshed [`OnboardingDetailResponseDto`](../../../../apps/internal-admin-service/src/modules/admin-consultant-onboarding/dto/responses/onboarding-detail-response.dto.ts). On reject the `blocked_until` field is now set to `now + 3 months`.

- **Side effects:**
  | Branch | DB writes | Notifications |
  | ------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
  | APPROVED | `onboarding.status = APPROVED`, `reviewed_by/reviewed_at` set, `consultant_profiles.is_verified = true` (same transaction). | In-app: `CONSULTANT_ONBOARDING_APPROVED` event → notification fan-out. Email: `sendApplicationApprovedEmail`. |
  | REJECTED | `onboarding.status = REJECTED`, `reviewed_by/reviewed_at`, `rejection_note`, `blocked_until = now + 3 months`. | Email: `sendApplicationRejectedEmail` with `reason` + `blocked_until`. Auth flow then refuses login / register / profile-submit for 3 months — see [consultant account gates](../../identity-service/auth/consultant-account-gates-api-specs.md#onboarding-rejection-block-read-first). |

- **Errors:**

  | HTTP | `error_code`                           | When                                                                                    |
  | ---- | -------------------------------------- | --------------------------------------------------------------------------------------- |
  | 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`      | Onboarding id does not exist.                                                           |
  | 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Onboarding is not in `INTERVIEW_SUBMITTED` (e.g. already decided).                      |
  | 422  | `GENERIC_VALIDATION_FAILED`            | `decision` is not one of `APPROVED`/`REJECTED`, or `rejection_note` exceeds 2000 chars. |
