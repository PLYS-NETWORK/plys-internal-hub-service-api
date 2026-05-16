# Consultant Onboarding — Consultant endpoints

> **Source:**
> [src/modules/consultant-onboarding/controllers/consultant-onboarding.controller.ts](../../../../src/modules/consultant-onboarding/controllers/consultant-onboarding.controller.ts)
> **Base path:** `/api/v1/consultant/onboarding`
> **Scope (applies to every endpoint):** Bearer auth, `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)`.
> **Field-name convention:** request/response payloads use **snake_case**.

## Cross-cutting errors

| HTTP | error_code                             | When                                                                                               |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`                 | Missing or invalid Bearer access token.                                                            |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED`        | Admin rejected the onboarding and the 3-month block is still active (`details.blocked_until`).     |
| 403  | (platform/role)                        | Token's `active_platform` ≠ `consultant` or role ≠ `USER`.                                         |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`      | The consultant has no onboarding row yet (only relevant for `/questions` and `/interview/submit`). |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Action not permitted in the current onboarding status (see per-endpoint notes).                    |
| 422  | (validation)                           | DTO shape failures (UUIDs, lengths, missing required fields).                                      |

---

## Endpoints

### 1. Get current onboarding status

- **Endpoint:** `GET /consultant/onboarding/status`
- **Response 200:** `OnboardingStatusResponseDto | null` — `null` when the consultant has never started the flow.

  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "IN_INTERVIEW",
    "decision": null,
    "rejection_note": null,
    "blocked_until": null,
    "profile_submitted_at": "2026-05-12T10:11:00.000Z",
    "interview_submitted_at": null,
    "reviewed_at": null,
    "created_at": "2026-05-10T08:00:00.000Z"
  }
  ```

- **Errors:** cross-cutting only.

---

### 2. Upload a CV or avatar (pre-step for Step 1)

CV and avatar uploads reuse the shared `/files` endpoint. They are not part of the onboarding controller — repeated here so the Lona app has a single reference.

- **Endpoint:** `POST /files?purpose=consultant_cv` (CV) or `POST /files?purpose=avatar` (avatar)
- **Content-Type:** `multipart/form-data`
- **Body (multipart):**
  - `file`: the file bytes (PDF / DOCX for CV; PNG / JPEG for avatar)
- **Query params:**
  - `purpose` (optional):
    - `consultant_cv` → file is stored under `consultant-CVs/<NODE_ENV>/...` and stamped with `purpose=consultant_cv`.
    - `avatar` → file is stored under `avatars/<NODE_ENV>/...` and stamped with `purpose=avatar`.
    - Any other value is silently ignored (file is treated as purpose-less and will be reclaimed by the weekly orphan sweep if never attached).
- **Response 201:** [`FileResponseDto`](../../../../src/modules/files/dto/responses/file-response.dto.ts) — keep the `url` and pass it as `cv_url` or `avatar_url` to the profile submission below.

  ```json
  {
    "id": "f4e9b1d3-...",
    "owner_user_id": "550e8400-...",
    "mime_type": "application/pdf",
    "size_bytes": 184321,
    "original_name": "Jane Doe — CV.pdf",
    "purpose": "consultant_cv",
    "url": "https://cdn.plysnetwork.com/consultant-CVs/production/2026/05/abc...pdf",
    "created_at": "2026-05-12T10:10:30.000Z"
  }
  ```

  Avatar response (illustrative):

  ```json
  {
    "id": "8c2a91b7-...",
    "owner_user_id": "550e8400-...",
    "mime_type": "image/jpeg",
    "size_bytes": 48210,
    "original_name": "jane.jpg",
    "purpose": "avatar",
    "url": "https://cdn.plysnetwork.com/avatars/production/2026/05/xyz...jpg",
    "created_at": "2026-05-12T10:09:55.000Z"
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 400 | `FILE_UPLOAD_FAILED` | No file part in the request. |
  | 413 | `FILE_SIZE_EXCEEDED` | File exceeds the per-request size limit. |
  | 413 | `FILE_QUOTA_EXCEEDED` | Per-user quota or count cap reached. |
  | 415 | `FILE_INVALID_TYPE` | Sniffed MIME not in the allow-list (avatar uploads must be PNG/JPEG). |

---

### 3. Step 1 — Submit basic profile

Writes the basic profile fields onto `ConsultantProfile` and advances the onboarding from `PENDING_BASIC_INFO` to `IN_INTERVIEW`. After this call the consultant can fetch the active question set and submit answers.

- **Endpoint:** `POST /consultant/onboarding/profile`
- **Body:** [`SubmitOnboardingProfileDto`](../../../../src/modules/consultant-onboarding/dto/requests/submit-onboarding-profile.dto.ts)

  ```json
  {
    "full_name": "Jane Doe",
    "bio": "Senior full-stack engineer with 7 years building SaaS products.",
    "years_of_experience": 7,
    "phone_number": "+905551234567",
    "country_code": "TR",
    "avatar_url": "https://cdn.example.com/u/jane.jpg",
    "cv_url": "https://cdn.plysnetwork.com/consultant-CVs/production/2026/05/abc...pdf"
  }
  ```

  | Field                 | Type   | Required | Constraints                                                                     |
  | --------------------- | ------ | -------- | ------------------------------------------------------------------------------- |
  | `full_name`           | string | yes      | 1–255 chars                                                                     |
  | `bio`                 | string | yes      | 1–5000 chars                                                                    |
  | `years_of_experience` | number | yes      | integer, 0–50                                                                   |
  | `phone_number`        | string | yes      | 5–30 chars                                                                      |
  | `country_code`        | string | yes      | ISO 3166-1 alpha-2 (uppercase, exactly 2 chars)                                 |
  | `avatar_url`          | string | no       | absolute URL with protocol — typically from `POST /files?purpose=avatar`        |
  | `cv_url`              | string | no       | absolute URL with protocol — typically from `POST /files?purpose=consultant_cv` |

- **Response 201:** `OnboardingStatusResponseDto` — same shape as endpoint 1, with `status = IN_INTERVIEW` and `profile_submitted_at` populated.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
  | 403 | `CONSULTANT_ONBOARDING_BLOCKED` | Admin rejected a prior onboarding and the 3-month block is still active (`details.blocked_until`). |
  | 409 | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Already past `PENDING_BASIC_INFO` (e.g. status is `IN_INTERVIEW`, `INTERVIEW_SUBMITTED`, `APPROVED`). |
  | 404 | `CONSULTANT_PROFILE_NOT_FOUND` | Registration row missing — should never happen in normal flow. |
  | 422 | (validation) | DTO failed validation. |

---

### 4. Step 2 — Read the active question set

Returns the global active onboarding-question set ordered by `position`, exactly what the consultant must answer. Allowed only when the onboarding is in `IN_INTERVIEW`.

- **Endpoint:** `GET /consultant/onboarding/questions`
- **Response 200:** [`OnboardingQuestionResponseDto[]`](../../../../src/modules/consultant-onboarding/dto/responses/onboarding-question-response.dto.ts)

  ```json
  [
    {
      "id": "01H8E5...",
      "type": "TEXT",
      "question": "Describe your most recent SaaS project.",
      "options": null,
      "position": 1
    },
    {
      "id": "01H8E6...",
      "type": "RADIO",
      "question": "Do you have prior remote-work experience?",
      "options": [
        { "value": "opt_yes_2y", "label": "Yes, more than 2 years" },
        { "value": "opt_yes_under_2", "label": "Yes, less than 2 years" },
        { "value": "opt_no", "label": "No" }
      ],
      "position": 2
    },
    {
      "id": "01H8E7...",
      "type": "CHECKBOX",
      "question": "Which of the following are part of your daily stack?",
      "options": [
        { "value": "ts", "label": "TypeScript" },
        { "value": "node", "label": "Node.js" },
        { "value": "postgres", "label": "PostgreSQL" },
        { "value": "k8s", "label": "Kubernetes" }
      ],
      "position": 3
    }
  ]
  ```

- **Errors:**
  | HTTP | error_code | When |
  | ---- | --------------------------------------- | ----------------------------------------------------------------------------- |
  | 404 | `CONSULTANT_ONBOARDING_NOT_FOUND` | Consultant never submitted Step 1 (no onboarding row). |
  | 409 | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Onboarding status is not `IN_INTERVIEW` (already submitted / not yet started). |

---

### 5. Step 2 — Submit all answers at once

Submits **every** answer in a single request and finalises the interview. Each entry must reference an active question id and the set must cover the active question set exactly (no duplicates, no foreign ids, no missing ids).

- **Endpoint:** `POST /consultant/onboarding/interview/submit`
- **Body:** [`SubmitOnboardingAnswersDto`](../../../../src/modules/consultant-onboarding/dto/requests/submit-onboarding-answers.dto.ts)

  ```json
  {
    "answers": [
      {
        "onboarding_question_id": "01H8E5...",
        "answer_value": {
          "text": "I led the migration of a hospitality SaaS from a Rails monolith to a Nest + Next stack..."
        }
      },
      {
        "onboarding_question_id": "01H8E6...",
        "answer_value": { "value": "opt_yes_2y" }
      },
      {
        "onboarding_question_id": "01H8E7...",
        "answer_value": { "values": ["ts", "node", "postgres"] }
      }
    ]
  }
  ```

  **Per-type validation:**
  - `TEXT` — `{ "text": <non-empty string> }`.
  - `RADIO` — `{ "value": <string matching one of the question's option `value`s> }`.
  - `CHECKBOX` — `{ "values": <non-empty array of strings, each matching one of the option `value`s, no duplicates> }`.

- **Response 200:**

  ```json
  null
  ```

- **Side effects on success:**
  1. Status → `INTERVIEW_SUBMITTED`, `interview_submitted_at = now`.
  2. Email to the consultant ("we received your submission").
  3. Email broadcast to active admins (first admin TO, rest CC) with a link to the review screen.

- **Errors:**
  | HTTP | error_code | When |
  | ---- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
  | 404 | `CONSULTANT_ONBOARDING_NOT_FOUND` | Consultant never submitted Step 1. |
  | 409 | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Onboarding is not in `IN_INTERVIEW` (e.g. already submitted, approved, or rejected). |
  | 422 | `CONSULTANT_ONBOARDING_ANSWERS_COVERAGE` | Missing, duplicate, or foreign `onboarding_question_id`s relative to the current active set. |
  | 422 | `CONSULTANT_ONBOARDING_INVALID_ANSWER` | An entry's shape does not match its question type (e.g. RADIO `value` not in options, CHECKBOX `values` empty). |
  | 422 | (validation) | DTO failed validation (e.g. missing `answers` array, malformed UUIDs). |

  Idempotency: the endpoint is **not** idempotent. After a successful call the status is `INTERVIEW_SUBMITTED`, so a retry returns `409 CONSULTANT_ONBOARDING_INVALID_STATUS`. The Lona app should treat that 409 as "already submitted" and surface a friendly state.

---

## Auth / blocking interaction

While the consultant's latest onboarding has `blocked_until > now` (after an admin REJECT), **every** call above is unreachable: login already fails with `403 CONSULTANT_ONBOARDING_BLOCKED`, so the client never gets a session to call these endpoints. See [auth](../auth/auth-api-specs.md#onboarding-rejection-block-read-first) for the full block matrix.
