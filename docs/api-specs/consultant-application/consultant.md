# Consultant Application API — Consultant Endpoints

> **Source:** [`src/modules/consultant-application/controllers/consultant-application.controller.ts`](../../../src/modules/consultant-application/controllers/consultant-application.controller.ts)  
> **Base path:** `/api/v1/consultant/application`  
> **Scope (applies to every endpoint):** Bearer auth, `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)`. Non-consultant callers receive `403`.  
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.  
> **Field-name convention:** request/response columns use **snake_case**.

---

## Flow overview

```
Register → Verify email → POST /profile  ──► [bg job: GENERATE_SKILL_QUESTIONS]
                                                        │
                                             ◄─── status: IN_INTERVIEW
                                                        │
                                       GET /interview ──► 30 questions returned
                                                        │
                                  POST /interview/answers (×30, idempotent)
                                                        │
                               POST /interview/submit ──► status: INTERVIEW_SUBMITTED
                                                           admin & consultant emailed
```

---

## Cross-cutting errors

| HTTP | `error_code`                                | When                                                              |
| ---- | ------------------------------------------- | ----------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                         | Missing or invalid Bearer token.                                  |
| 403  | `CONSULTANT_APPLICATION_BLOCKED`            | Consultant is currently under a 3-month re-application block.     |
| 403  | (forbidden, no error_code)                  | Caller is not `UserRole.USER` or not `ActivePlatform.CONSULTANT`. |
| 409  | `CONSULTANT_APPLICATION_INVALID_STATUS`     | Action not permitted for the application's current status.        |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`          | No active application found for the authenticated user.           |
| 422  | `CONSULTANT_APPLICATION_INCOMPLETE_ANSWERS` | Fewer than 30 answers submitted when finalising.                  |
| 422  | (validation)                                | DTO shape failures.                                               |

---

## Endpoints

### 1. Get application status

- **Endpoint:** `GET /consultant/application/status`
- **Auth:** Bearer token required
- **Description:** Returns the current application status for the authenticated consultant. Returns `null` in `data` if no application exists yet.

#### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "IN_INTERVIEW",
    "blocked_until": null,
    "created_at": "2026-05-10T09:00:00.000Z"
  },
  "timestamp": "2026-05-10T10:00:00.000Z",
  "path": "/api/v1/consultant/application/status"
}
```

| Field           | Type                | Description                                                                  |
| --------------- | ------------------- | ---------------------------------------------------------------------------- |
| `id`            | `string`            | Application UUID                                                             |
| `status`        | `ApplicationStatus` | Current status — see [Application Status Values](#application-status-values) |
| `blocked_until` | `string \| null`    | ISO-8601 date until which the consultant is blocked; `null` if not blocked   |
| `created_at`    | `string`            | ISO-8601 creation timestamp                                                  |

**When no application exists:** `data` is `null`.

---

### 2. Submit profile

- **Endpoint:** `POST /consultant/application/profile`
- **Auth:** Bearer token required
- **Description:** Creates a new application (or resets a `PENDING_PROFILE` one) and updates the consultant's profile fields and skills. Triggers the `GENERATE_SKILL_QUESTIONS` background job, which assigns 30 questions and transitions status to `IN_INTERVIEW`.

#### Request Body

```json
{
  "headline": "Senior Full-Stack Engineer",
  "bio": "I have 7 years of experience building scalable SaaS products...",
  "years_of_experience": 7,
  "skill_ids": ["uuid-skill-1", "uuid-skill-2", "uuid-skill-3"]
}
```

| Field                 | Type       | Required | Constraints                                 |
| --------------------- | ---------- | -------- | ------------------------------------------- |
| `headline`            | `string`   | Yes      | Non-empty                                   |
| `bio`                 | `string`   | Yes      | Non-empty                                   |
| `years_of_experience` | `number`   | Yes      | Integer, 0–50                               |
| `skill_ids`           | `string[]` | Yes      | 3–10 unique UUIDs from the skills catalogue |

#### Response 200

```json
{
  "status_code": 200,
  "message": "Profile submitted successfully.",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "GENERATING_QUESTIONS",
    "blocked_until": null,
    "created_at": "2026-05-10T09:00:00.000Z"
  },
  "timestamp": "2026-05-10T10:00:00.000Z",
  "path": "/api/v1/consultant/application/profile"
}
```

#### Errors

| HTTP | `error_code`                            | When                                                                         |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------- |
| 403  | `CONSULTANT_APPLICATION_BLOCKED`        | Active 3-month block. `details.blocked_until` contains the unblock ISO date. |
| 409  | `CONSULTANT_APPLICATION_INVALID_STATUS` | Active application is not in `PENDING_PROFILE`.                              |
| 422  | (validation)                            | Constraint violations (e.g. fewer than 3 skills).                            |

---

### 3. Get interview questions

- **Endpoint:** `GET /consultant/application/interview`
- **Auth:** Bearer token required
- **Description:** Returns the 30 assigned interview questions. Each question includes the saved answer text if one was already submitted. Only accessible when `status = IN_INTERVIEW`.

#### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": [
    {
      "id": "aq-uuid-1",
      "application_question_id": "aq-uuid-1",
      "question_order": 1,
      "type": "COMMUNICATION",
      "content": "Describe a time when you had to explain a complex technical concept to a non-technical stakeholder.",
      "answer_text": null
    },
    {
      "id": "aq-uuid-11",
      "application_question_id": "aq-uuid-11",
      "question_order": 11,
      "type": "SKILL_BASED",
      "content": "How would you design a REST API for a high-traffic e-commerce checkout system?",
      "answer_text": "I would start by identifying the bounded contexts..."
    }
  ],
  "timestamp": "2026-05-10T10:00:00.000Z",
  "path": "/api/v1/consultant/application/interview"
}
```

| Field                     | Type             | Description                                                             |
| ------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `id`                      | `string`         | Same as `application_question_id`                                       |
| `application_question_id` | `string`         | UUID to reference when submitting answers                               |
| `question_order`          | `number`         | 1–30 (1–10: COMMUNICATION, 11–25: SKILL_BASED, 26–30: SYSTEM_KNOWLEDGE) |
| `type`                    | `QuestionType`   | `COMMUNICATION`, `SKILL_BASED`, or `SYSTEM_KNOWLEDGE`                   |
| `content`                 | `string`         | Question text                                                           |
| `answer_text`             | `string \| null` | Saved answer, or `null` if not yet submitted                            |

#### Errors

| HTTP | `error_code`                                 | When                          |
| ---- | -------------------------------------------- | ----------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`           | No active application found.  |
| 409  | `CONSULTANT_APPLICATION_INTERVIEW_NOT_READY` | Status is not `IN_INTERVIEW`. |

---

### 4. Submit an answer

- **Endpoint:** `POST /consultant/application/interview/answers`
- **Auth:** Bearer token required
- **Description:** Saves or updates the answer to a single interview question. **Idempotent** — calling again with the same `application_question_id` overwrites the previous answer. The consultant can update any answer until they call `POST /interview/submit`.

#### Request Body

```json
{
  "application_question_id": "aq-uuid-11",
  "answer_text": "I would start by identifying the bounded contexts..."
}
```

| Field                     | Type     | Required | Constraints                   |
| ------------------------- | -------- | -------- | ----------------------------- |
| `application_question_id` | `string` | Yes      | UUID of the assigned question |
| `answer_text`             | `string` | Yes      | Non-empty, 10–5000 characters |

#### Response 200

```json
{
  "status_code": 200,
  "message": "Answer submitted successfully.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-10T10:00:00.000Z",
  "path": "/api/v1/consultant/application/interview/answers"
}
```

#### Errors

| HTTP | `error_code`                                 | When                                                      |
| ---- | -------------------------------------------- | --------------------------------------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`           | No active application, or question does not belong to it. |
| 409  | `CONSULTANT_APPLICATION_INTERVIEW_NOT_READY` | Status is not `IN_INTERVIEW`.                             |
| 422  | (validation)                                 | `answer_text` too short/long or not a valid UUID.         |

---

### 5. Finalise interview

- **Endpoint:** `POST /consultant/application/interview/submit`
- **Auth:** Bearer token required
- **Description:** Locks the interview. Validates that all 30 questions have answers, transitions status to `INTERVIEW_SUBMITTED`, sends a confirmation email to the consultant, and emails all active admins with a link to review the application.

#### Request Body

None.

#### Response 200

```json
{
  "status_code": 200,
  "message": "Interview submitted successfully. You will be notified when evaluation is complete.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-10T10:00:00.000Z",
  "path": "/api/v1/consultant/application/interview/submit"
}
```

#### Errors

| HTTP | `error_code`                                 | When                                                                                      |
| ---- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`           | No active application.                                                                    |
| 409  | `CONSULTANT_APPLICATION_INTERVIEW_NOT_READY` | Status is not `IN_INTERVIEW`.                                                             |
| 422  | `CONSULTANT_APPLICATION_INCOMPLETE_ANSWERS`  | Fewer than 30 answers saved. `details.answered` and `details.required` indicate progress. |

---

## Application Status Values

| Value                      | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `PENDING_PROFILE`          | Email verified; profile not yet submitted                      |
| `GENERATING_QUESTIONS`     | Background job is generating the 30 skill-based questions      |
| `IN_INTERVIEW`             | Questions ready; consultant is answering                       |
| `INTERVIEW_SUBMITTED`      | All 30 answers submitted; awaiting admin trigger               |
| `RUNNING_COPYLEAKS`        | Admin triggered; Copyleaks AI-content check running            |
| `COPYLEAKS_FAILED`         | AI-generated content detected; consultant blocked for 3 months |
| `PENDING_AI_EVALUATION`    | Copyleaks passed; AI scoring job running                       |
| `PENDING_ADMIN_EVALUATION` | AI scoring complete; admin must score manual questions         |
| `PENDING_FINAL_DECISION`   | All scores computed; admin makes the final call                |
| `APPROVED`                 | Application approved; `ConsultantProfile.isVerified = true`    |
| `REJECTED`                 | Score below threshold; consultant blocked for 3 months         |

---

## Error Codes

| `error_code`                                 | HTTP | Description                                                                          |
| -------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `CONSULTANT_APPLICATION_NOT_FOUND`           | 404  | No active application found for the caller                                           |
| `CONSULTANT_APPLICATION_BLOCKED`             | 403  | Consultant is under a 3-month re-application block; `details.blocked_until` provided |
| `CONSULTANT_APPLICATION_INVALID_STATUS`      | 409  | Current status does not allow the requested action                                   |
| `CONSULTANT_APPLICATION_INTERVIEW_NOT_READY` | 409  | Interview questions not yet assigned or already submitted                            |
| `CONSULTANT_APPLICATION_INCOMPLETE_ANSWERS`  | 422  | Not all 30 answers present; `details.answered` / `details.required` in response      |
