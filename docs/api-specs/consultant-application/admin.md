# Consultant Onboarding API — Admin Endpoints

> **Source:** [`src/modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller.ts`](../../../src/modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller.ts)
> **Base path:** `/api/v1/admin/onboardings`
> **Scope (applies to every endpoint):** Bearer auth, `@Roles(UserRole.ADMIN_PLATFORM)`. Non-admin callers receive `403`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case**.

---

## Where this fits in the flow

After a consultant submits their onboarding interview (`POST /consultant/onboarding/interview/submit`), the row moves to `INTERVIEW_SUBMITTED` and an email is sent to every active admin (first admin in `TO`, rest in `CC`). The admin then opens the application, reads the 10 answers, and decides.

```
Consultant                              Admin (Internal Hub)
──────────                              ────────────────────
POST /onboarding/interview/submit ───►  GET /admin/onboardings           (filter status=INTERVIEW_SUBMITTED)
                                        GET /admin/onboardings/:id       (read 10 Q&As)
                                        POST /admin/onboardings/:id/decide
                                          ├── decision=APPROVED  → ConsultantProfile.isVerified=true
                                          │                      → consultant can register skill exams
                                          │                      → in-app + email notifications
                                          └── decision=REJECTED  → blocked_until = now + 3 months
                                                                 → consultant emailed with rejection_note
```

Onboarding evaluation is **human-only** — no Copyleaks or AI scoring at this stage. (Skill-exam evaluation is fully automated; admins have no manual scoring step there either.)

---

## Cross-cutting errors

| HTTP | `error_code`                           | When                                                               |
| ---- | -------------------------------------- | ------------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`                    | Missing or invalid Bearer token.                                   |
| 403  | (forbidden, no error_code)             | Caller is not `UserRole.ADMIN_PLATFORM`.                           |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`      | No onboarding row matches the path `:id`.                          |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Action not permitted for the onboarding's current status.          |
| 422  | `GENERIC_VALIDATION_FAILED`            | DTO shape failure (e.g. `decision` not in enum, `:id` not a UUID). |
| 500  | `GENERIC_INTERNAL_SERVER_ERROR`        | Unhandled server error.                                            |

---

## 1. List onboardings (paginated)

- **Endpoint:** `GET /admin/onboardings`
- **Description:** Returns consultant onboardings, newest first, with an optional status filter.

### Query parameters

| Name     | Type   | Required | Constraints                                                                                 | Default |
| -------- | ------ | -------- | ------------------------------------------------------------------------------------------- | ------- |
| `status` | enum   | No       | One of: `PENDING_BASIC_INFO`, `IN_INTERVIEW`, `INTERVIEW_SUBMITTED`, `APPROVED`, `REJECTED` | —       |
| `page`   | number | No       | Integer ≥ 1                                                                                 | `1`     |
| `take`   | number | No       | Integer, 1–100                                                                              | `20`    |

### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "user_id": "ab1de2f3-0000-1111-2222-333344445555",
        "consultant_email": "jane@example.com",
        "consultant_name": "Jane Doe",
        "status": "INTERVIEW_SUBMITTED",
        "decision": null,
        "profile_submitted_at": "2026-05-10T09:00:00.000Z",
        "interview_submitted_at": "2026-05-12T10:30:00.000Z",
        "reviewed_at": null,
        "created_at": "2026-05-10T09:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "take": 20,
      "item_count": 1,
      "page_count": 1,
      "has_previous_page": false,
      "has_next_page": false
    }
  },
  "timestamp": "2026-05-12T11:00:00.000Z",
  "path": "/api/v1/admin/onboardings"
}
```

| `data[i]` field          | Type               | Description                                            |
| ------------------------ | ------------------ | ------------------------------------------------------ |
| `id`                     | `string`           | Onboarding UUID                                        |
| `user_id`                | `string`           | Consultant's User UUID                                 |
| `consultant_email`       | `string`           | Consultant's email                                     |
| `consultant_name`        | `string`           | `ConsultantProfile.fullName` (empty string if not set) |
| `status`                 | `OnboardingStatus` | See enum values below                                  |
| `decision`               | `string \| null`   | `APPROVED`, `REJECTED`, or null when pending           |
| `profile_submitted_at`   | `string \| null`   | ISO-8601                                               |
| `interview_submitted_at` | `string \| null`   | ISO-8601                                               |
| `reviewed_at`            | `string \| null`   | ISO-8601 — set by `decide`                             |
| `created_at`             | `string`           | ISO-8601                                               |

`meta` follows the project-wide pagination shape (`page`, `take`, `item_count`, `page_count`, `has_previous_page`, `has_next_page`).

### Errors

Only cross-cutting (auth/role/validation) errors apply.

---

## 2. Get onboarding detail

- **Endpoint:** `GET /admin/onboardings/:id`
- **Description:** Full onboarding view including basic profile fields and all 10 questions with their answers.

### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "ab1de2f3-0000-1111-2222-333344445555",
    "consultant_email": "jane@example.com",
    "consultant_name": "Jane Doe",
    "bio": "I have 7 years of experience building scalable SaaS products...",
    "years_of_experience": 7,
    "phone_number": "+905551234567",
    "country_code": "TR",
    "avatar_url": "https://cdn.example.com/u/jane.jpg",
    "cv_url": "https://cdn.example.com/u/jane-cv.pdf",
    "status": "INTERVIEW_SUBMITTED",
    "decision": null,
    "rejection_note": null,
    "blocked_until": null,
    "profile_submitted_at": "2026-05-10T09:00:00.000Z",
    "interview_submitted_at": "2026-05-12T10:30:00.000Z",
    "reviewed_at": null,
    "reviewed_by": null,
    "created_at": "2026-05-10T09:00:00.000Z",
    "answers": [
      {
        "onboarding_question_id": "oq-uuid-1",
        "question_order": 1,
        "type": "COMMUNICATION",
        "content": "Describe a time when you had to explain a complex technical concept to a non-technical stakeholder.",
        "answer_text": "Last quarter I led a debrief with our marketing team after migrating our analytics pipeline...",
        "submitted_at": "2026-05-11T14:00:00.000Z"
      },
      {
        "onboarding_question_id": "oq-uuid-6",
        "question_order": 6,
        "type": "SYSTEM_KNOWLEDGE",
        "content": "Explain how you would design a rate limiter for a public API.",
        "answer_text": "I would use a token-bucket algorithm backed by Redis...",
        "submitted_at": "2026-05-11T14:30:00.000Z"
      }
    ]
  },
  "timestamp": "2026-05-12T11:00:00.000Z",
  "path": "/api/v1/admin/onboardings/550e8400-e29b-41d4-a716-446655440000"
}
```

| Field                    | Type               | Description                                                  |
| ------------------------ | ------------------ | ------------------------------------------------------------ |
| `id`                     | `string`           | Onboarding UUID                                              |
| `user_id`                | `string`           | Consultant's User UUID                                       |
| `consultant_email`       | `string`           | Consultant's email                                           |
| `consultant_name`        | `string`           | Display name from `ConsultantProfile.fullName`               |
| `bio`                    | `string \| null`   | Submitted bio                                                |
| `years_of_experience`    | `number \| null`   | 0–50                                                         |
| `phone_number`           | `string \| null`   | E.164                                                        |
| `country_code`           | `string \| null`   | ISO 3166-1 alpha-2                                           |
| `avatar_url`             | `string \| null`   | Optional avatar URL                                          |
| `cv_url`                 | `string \| null`   | Optional CV URL                                              |
| `status`                 | `OnboardingStatus` | See enum                                                     |
| `decision`               | `string \| null`   | `APPROVED`, `REJECTED`, or null                              |
| `rejection_note`         | `string \| null`   | Admin's free-text note when `decision === REJECTED`          |
| `blocked_until`          | `string \| null`   | ISO-8601; set on REJECTED                                    |
| `profile_submitted_at`   | `string \| null`   | ISO-8601                                                     |
| `interview_submitted_at` | `string \| null`   | ISO-8601                                                     |
| `reviewed_at`            | `string \| null`   | ISO-8601                                                     |
| `reviewed_by`            | `string \| null`   | UUID of the admin who decided                                |
| `created_at`             | `string`           | ISO-8601                                                     |
| `answers[i]`             | object             | One row per assigned question, in `question_order` ascending |

### Errors

| HTTP | `error_code`                      | When                           |
| ---- | --------------------------------- | ------------------------------ |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND` | No onboarding with this `:id`. |
| 422  | `GENERIC_VALIDATION_FAILED`       | `:id` is not a UUID.           |

---

## 3. Decide on onboarding (approve or reject)

- **Endpoint:** `POST /admin/onboardings/:id/decide`
- **Description:** Records the admin's decision. Allowed only when the onboarding is in `INTERVIEW_SUBMITTED`.
  - **APPROVED**: sets `ConsultantProfile.isVerified = true`, sends the approval email, and emits the `CONSULTANT_ONBOARDING_APPROVED` event (drives the in-app notification + Socket.IO push).
  - **REJECTED**: sets `blocked_until = now + 3 months`, persists the admin-supplied `rejection_note`, and sends the rejection email to the consultant.

### Request body

```json
{
  "decision": "APPROVED"
}
```

or

```json
{
  "decision": "REJECTED",
  "rejection_note": "Answers were too shallow — please re-apply with more concrete examples."
}
```

| Field            | Type     | Required | Constraints                                                    |
| ---------------- | -------- | -------- | -------------------------------------------------------------- |
| `decision`       | enum     | Yes      | `APPROVED` or `REJECTED`                                       |
| `rejection_note` | `string` | No       | Optional even when REJECTED; max 2000 characters when present. |

### Response 200

```json
{
  "status_code": 200,
  "message": "Onboarding approved.",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "APPROVED",
    "decision": "APPROVED",
    "rejection_note": null,
    "blocked_until": null,
    "reviewed_by": "admin-uuid",
    "reviewed_at": "2026-05-12T11:00:00.000Z",
    "answers": [
      /* … same 10 Q&As as in detail view … */
    ]
  },
  "timestamp": "2026-05-12T11:00:00.000Z",
  "path": "/api/v1/admin/onboardings/550e8400-e29b-41d4-a716-446655440000/decide"
}
```

The full `OnboardingDetailResponseDto` is returned (same shape as `GET /admin/onboardings/:id`).

`message` resolves from i18n: `success.consultant_onboarding.approved` or `success.consultant_onboarding.rejected`.

### Errors

| HTTP | `error_code`                           | When                                                                                  |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`      | No onboarding with this `:id`.                                                        |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Status is not `INTERVIEW_SUBMITTED` — e.g. already decided, or still in interview.    |
| 422  | `GENERIC_VALIDATION_FAILED`            | `decision` not in enum, `rejection_note` longer than 2000 chars, or `:id` not a UUID. |

### Side effects on success

| Decision   | DB writes                                                                                                                          | Notifications fired                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `APPROVED` | `ConsultantOnboarding`: `status=APPROVED`, `decision=APPROVED`, `reviewed_by`, `reviewed_at`. `ConsultantProfile.isVerified=true`. | Email → consultant (approval template). In-app → consultant (`CONSULTANT_ONBOARDING_APPROVED`). |
| `REJECTED` | `ConsultantOnboarding`: `status=REJECTED`, `decision=REJECTED`, `rejection_note`, `blocked_until`, `reviewed_by`, `reviewed_at`.   | Email → consultant (rejection template, includes `rejection_note` + `blocked_until`).           |

After an approved decision, the consultant can immediately register skill exams via `POST /consultant/skill-exams`.

---

## Reference

### Onboarding Status Values

| Value                 | Description                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `PENDING_BASIC_INFO`  | User exists, has not submitted `POST /consultant/onboarding/profile`.                               |
| `IN_INTERVIEW`        | 10 onboarding questions assigned; consultant is answering.                                          |
| `INTERVIEW_SUBMITTED` | All 10 answers submitted; **this is the only status `POST /:id/decide` accepts**.                   |
| `APPROVED`            | Admin approved. `ConsultantProfile.isVerified=true`. Consultant may now register skill exams.       |
| `REJECTED`            | Admin rejected. `blocked_until = now + 3 months`. Consultant can re-onboard after the block lapses. |

### Error Codes (full catalogue for these endpoints)

| `error_code`                           | HTTP | Description                                                       |
| -------------------------------------- | ---- | ----------------------------------------------------------------- |
| `CONSULTANT_ONBOARDING_NOT_FOUND`      | 404  | No onboarding row matches the path `:id`.                         |
| `CONSULTANT_ONBOARDING_INVALID_STATUS` | 409  | Decision attempted on an onboarding not in `INTERVIEW_SUBMITTED`. |
| `GENERIC_VALIDATION_FAILED`            | 422  | DTO/path validation failure.                                      |

### Notes on idempotency and side effects

- `POST /:id/decide` is **not** idempotent — a second call after a decision lands returns `CONSULTANT_ONBOARDING_INVALID_STATUS` (the status is now `APPROVED` or `REJECTED`).
- The 3-month block is enforced both at registration (`POST /auth/register` for `active_platform=consultant`) and at profile submission (`POST /consultant/onboarding/profile`) — both return `403 CONSULTANT_ONBOARDING_BLOCKED` with `details.blocked_until`.
- The admin-broadcast email at `INTERVIEW_SUBMITTED` uses the **first admin in TO, rest in CC** dispatch pattern so one admin owns each thread while the rest stay informed.
- Skill-exam admin endpoints are not yet implemented (the per-skill exam flow is fully automated — no admin scoring step). See [`consultant.md`](./consultant.md) for the consultant-side skill-exam flow.
