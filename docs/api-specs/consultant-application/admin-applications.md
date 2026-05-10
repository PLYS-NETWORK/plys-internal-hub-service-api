# Consultant Application API — Admin Endpoints

> **Source:** [`src/modules/consultant-application/controllers/admin-consultant-application.controller.ts`](../../../src/modules/consultant-application/controllers/admin-consultant-application.controller.ts)  
> **Base path:** `/api/v1/admin/consultant-applications`  
> **Scope (applies to every endpoint):** Bearer auth, `@Roles(UserRole.ADMIN_PLATFORM)`. Non-admin callers receive `403`. No `@Platform` guard — admins are platform-wide.  
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.  
> **Field-name convention:** request/response columns use **snake_case**.

---

## Evaluation pipeline overview

```
[Consultant submits interview]
        │
        ▼
POST /:id/start-evaluation          ──► status: RUNNING_COPYLEAKS  [bg job]
                                                  │
                              ┌───────────────────┴────────────────────┐
                         aggregateAiScore < 30                  aggregateAiScore ≥ 30
                         (originality > 70%)                    (too much AI content)
                              │                                         │
                    status: PENDING_AI_EVALUATION           status: COPYLEAKS_FAILED
                    [bg job: RUN_AI_EVALUATION]             consultant blocked 3 months
                              │                             rejection email sent
                    status: PENDING_ADMIN_EVALUATION
                              │
             GET /:id/manual-questions  (COMMUNICATION + SYSTEM_KNOWLEDGE)
                              │
             PATCH /:id/manual-evaluation  ──► finalScore = AI×0.6 + Admin×0.4
                              │                status: PENDING_FINAL_DECISION
                              │
             POST /:id/decide
              ├── APPROVED  ──► isVerified=true, skill scores saved, approval email
              └── REJECTED  ──► blocked 3 months, rejection email
```

**Pass threshold:** `finalScore ≥ 80`

---

## Cross-cutting errors

| HTTP | `error_code`                            | When                                                       |
| ---- | --------------------------------------- | ---------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                     | Missing or invalid Bearer token.                           |
| 403  | (forbidden, no error_code)              | Caller is not `UserRole.ADMIN_PLATFORM`.                   |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`      | Application UUID does not exist.                           |
| 409  | `CONSULTANT_APPLICATION_INVALID_STATUS` | Action not permitted for the application's current status. |
| 422  | (validation)                            | DTO shape failures or invalid UUID path parameter.         |

---

## Endpoints

### 1. List applications

- **Endpoint:** `GET /admin/consultant-applications`
- **Auth:** Bearer token required, admin only
- **Description:** Returns a paginated list of consultant applications. Filterable by status and keyword (email substring search).

#### Query Parameters

| Parameter | Type                | Required | Default | Notes                                                    |
| --------- | ------------------- | -------- | ------- | -------------------------------------------------------- |
| `status`  | `ApplicationStatus` | No       | —       | Filter to a specific status value                        |
| `keyword` | `string`            | No       | —       | Case-insensitive substring match on the consultant email |
| `page`    | `number`            | No       | `1`     | Min `1`                                                  |
| `take`    | `number`            | No       | `20`    | Min `1`, max `100`                                       |

#### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "consultant_email": "jane@example.com",
        "status": "INTERVIEW_SUBMITTED",
        "created_at": "2026-05-10T09:00:00.000Z",
        "interview_submitted_at": "2026-05-10T11:30:00.000Z",
        "final_score": null
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
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/consultant-applications"
}
```

**List item fields:**

| Field                    | Type                | Description                                                     |
| ------------------------ | ------------------- | --------------------------------------------------------------- |
| `id`                     | `string`            | Application UUID                                                |
| `consultant_email`       | `string`            | Email of the applying consultant                                |
| `status`                 | `ApplicationStatus` | Current pipeline status                                         |
| `created_at`             | `string`            | ISO-8601 creation timestamp                                     |
| `interview_submitted_at` | `string \| null`    | ISO-8601 timestamp when the consultant submitted all 30 answers |
| `final_score`            | `number \| null`    | Computed final score (0–100); `null` until scoring is complete  |

---

### 2. Get application detail

- **Endpoint:** `GET /admin/consultant-applications/:id`
- **Auth:** Bearer token required, admin only
- **Description:** Returns the full application record including all 30 Q&As with per-answer scores.

#### Path Parameters

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `id`      | `string` | Application UUID |

#### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PENDING_ADMIN_EVALUATION",
    "consultant_email": "jane@example.com",
    "profile_submitted_at": "2026-05-10T09:00:00.000Z",
    "interview_submitted_at": "2026-05-10T11:30:00.000Z",
    "copyleaks_score": 12.4,
    "ai_eval_score": 82.5,
    "admin_eval_score": null,
    "final_score": null,
    "blocked_until": null,
    "rejection_reason": null,
    "answers": [
      {
        "application_question_id": "aq-uuid-1",
        "question_order": 1,
        "type": "COMMUNICATION",
        "content": "Describe a time when you had to explain a complex technical concept...",
        "answer_text": "In my previous role at...",
        "copyleaks_ai_score": 8.2,
        "ai_eval_score": 85.0,
        "ai_feedback": "Clear and well-structured response demonstrating strong communication.",
        "admin_score": null,
        "admin_notes": null
      }
    ],
    "created_at": "2026-05-10T09:00:00.000Z"
  },
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/consultant-applications/550e8400-e29b-41d4-a716-446655440000"
}
```

**Top-level fields:**

| Field                    | Type                | Description                                                                     |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------- |
| `id`                     | `string`            | Application UUID                                                                |
| `status`                 | `ApplicationStatus` | Current pipeline status                                                         |
| `consultant_email`       | `string`            | Email of the applying consultant                                                |
| `profile_submitted_at`   | `string \| null`    | ISO-8601 when profile was submitted                                             |
| `interview_submitted_at` | `string \| null`    | ISO-8601 when all 30 answers were locked                                        |
| `copyleaks_score`        | `number \| null`    | Aggregate Copyleaks AI-generation score (0–100); lower = more original          |
| `ai_eval_score`          | `number \| null`    | Overall AI evaluation score (0–100)                                             |
| `admin_eval_score`       | `number \| null`    | Admin manual evaluation score (0–100)                                           |
| `final_score`            | `number \| null`    | `ai_eval_score × 0.6 + admin_eval_score × 0.4`; `null` until both scores are in |
| `blocked_until`          | `string \| null`    | ISO-8601 block expiry date, or `null`                                           |
| `rejection_reason`       | `string \| null`    | `"COPYLEAKS_FAILED"`, `"LOW_SCORE"`, or a custom string                         |
| `answers`                | `AnswerDetail[]`    | All 30 questions with saved answers and scores                                  |
| `created_at`             | `string`            | ISO-8601 creation timestamp                                                     |

**Answer detail fields (`answers[]`):**

| Field                     | Type             | Description                                                      |
| ------------------------- | ---------------- | ---------------------------------------------------------------- |
| `application_question_id` | `string`         | UUID identifying the assigned question                           |
| `question_order`          | `number`         | 1–30                                                             |
| `type`                    | `QuestionType`   | `COMMUNICATION`, `SKILL_BASED`, or `SYSTEM_KNOWLEDGE`            |
| `content`                 | `string`         | Immutable question text snapshot                                 |
| `answer_text`             | `string \| null` | Submitted answer, or `null` if not yet answered                  |
| `copyleaks_ai_score`      | `number \| null` | Per-answer Copyleaks AI probability (0–100)                      |
| `ai_eval_score`           | `number \| null` | AI score for this answer (0–100)                                 |
| `ai_feedback`             | `string \| null` | One-sentence AI explanation for the score                        |
| `admin_score`             | `number \| null` | Admin score for COMMUNICATION / SYSTEM_KNOWLEDGE answers (0–100) |
| `admin_notes`             | `string \| null` | Admin notes                                                      |

#### Errors

| HTTP | `error_code`                       | When                            |
| ---- | ---------------------------------- | ------------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND` | Application UUID does not exist |

---

### 3. Start evaluation pipeline

- **Endpoint:** `POST /admin/consultant-applications/:id/start-evaluation`
- **Auth:** Bearer token required, admin only
- **Description:** Triggers the evaluation pipeline for a submitted interview. Sets status to `RUNNING_COPYLEAKS` and dispatches the `RUN_COPYLEAKS_EVALUATION` background job. **Requires status `= INTERVIEW_SUBMITTED`.**

#### Path Parameters

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `id`      | `string` | Application UUID |

#### Request Body

None.

#### Response 200

```json
{
  "status_code": 200,
  "message": "Evaluation pipeline started.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/consultant-applications/550e8400.../start-evaluation"
}
```

#### Errors

| HTTP | `error_code`                            | When                                                                                                                                                                                                 |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`      | Application UUID does not exist.                                                                                                                                                                     |
| 409  | `CONSULTANT_APPLICATION_INVALID_STATUS` | Status is not `INTERVIEW_SUBMITTED`. If status is `RUNNING_COPYLEAKS` and the background job failed, the status was automatically reverted to `INTERVIEW_SUBMITTED` so this endpoint can be retried. |

---

### 4. Get manual scoring questions

- **Endpoint:** `GET /admin/consultant-applications/:id/manual-questions`
- **Auth:** Bearer token required, admin only
- **Description:** Returns only the `COMMUNICATION` (10) and `SYSTEM_KNOWLEDGE` (5) questions with their submitted answers, ready for manual admin scoring. **Requires status `= PENDING_ADMIN_EVALUATION`.**

#### Path Parameters

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `id`      | `string` | Application UUID |

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
      "content": "Describe a time when you had to explain a complex technical concept...",
      "answer_text": "In my previous role at..."
    }
  ],
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/consultant-applications/550e8400.../manual-questions"
}
```

#### Errors

| HTTP | `error_code`                            | When                                      |
| ---- | --------------------------------------- | ----------------------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`      | Application UUID does not exist.          |
| 409  | `CONSULTANT_APPLICATION_INVALID_STATUS` | Status is not `PENDING_ADMIN_EVALUATION`. |

---

### 5. Submit manual evaluation scores

- **Endpoint:** `PATCH /admin/consultant-applications/:id/manual-evaluation`
- **Auth:** Bearer token required, admin only
- **Description:** Saves admin per-answer scores for `COMMUNICATION` and `SYSTEM_KNOWLEDGE` questions. Calculates `finalScore = aiEvalScore × 0.6 + adminEvalScore × 0.4` and transitions status to `PENDING_FINAL_DECISION`. **Requires status `= PENDING_ADMIN_EVALUATION`.**

#### Path Parameters

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `id`      | `string` | Application UUID |

#### Request Body

```json
{
  "scores": [
    {
      "application_question_id": "aq-uuid-1",
      "score": 88,
      "notes": "Strong real-world example, clear communication."
    },
    {
      "application_question_id": "aq-uuid-2",
      "score": 72
    }
  ],
  "admin_eval_score": 80
}
```

**Top-level fields:**

| Field              | Type           | Required | Constraints                                   |
| ------------------ | -------------- | -------- | --------------------------------------------- |
| `scores`           | `ScoreEntry[]` | Yes      | Per-answer scores for manual questions        |
| `admin_eval_score` | `number`       | Yes      | Integer 0–100; overall admin evaluation score |

**`scores[]` entry fields:**

| Field                     | Type     | Required | Constraints                    |
| ------------------------- | -------- | -------- | ------------------------------ |
| `application_question_id` | `string` | Yes      | UUID of the assigned question  |
| `score`                   | `number` | Yes      | Integer 0–100                  |
| `notes`                   | `string` | No       | Optional free-text admin notes |

#### Response 200

```json
{
  "status_code": 200,
  "message": "Manual evaluation submitted.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/consultant-applications/550e8400.../manual-evaluation"
}
```

#### Errors

| HTTP | `error_code`                            | When                                         |
| ---- | --------------------------------------- | -------------------------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`      | Application UUID does not exist.             |
| 409  | `CONSULTANT_APPLICATION_INVALID_STATUS` | Status is not `PENDING_ADMIN_EVALUATION`.    |
| 422  | (validation)                            | Score out of 0–100 range, invalid UUID, etc. |

---

### 6. Make final decision

- **Endpoint:** `POST /admin/consultant-applications/:id/decide`
- **Auth:** Bearer token required, admin only
- **Description:** Approves or rejects the application. **Requires status `= PENDING_FINAL_DECISION`.**
  - **APPROVED:** `ConsultantProfile.isVerified = true`, per-skill scores saved to `consultant_skill_scores`, approval email sent to consultant.
  - **REJECTED:** `blockedUntil = NOW() + 3 months`, rejection email sent to consultant.

#### Path Parameters

| Parameter | Type     | Description      |
| --------- | -------- | ---------------- |
| `id`      | `string` | Application UUID |

#### Request Body

```json
{
  "decision": "APPROVED"
}
```

Or with rejection:

```json
{
  "decision": "REJECTED",
  "rejection_reason": "Score did not meet the minimum threshold of 80."
}
```

| Field              | Type     | Required | Constraints                               |
| ------------------ | -------- | -------- | ----------------------------------------- |
| `decision`         | `string` | Yes      | Must be `"APPROVED"` or `"REJECTED"`      |
| `rejection_reason` | `string` | No       | Free-text reason shown in rejection email |

#### Response 200

```json
{
  "status_code": 200,
  "message": "Decision recorded successfully.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-10T12:00:00.000Z",
  "path": "/api/v1/admin/consultant-applications/550e8400.../decide"
}
```

#### Errors

| HTTP | `error_code`                            | When                                         |
| ---- | --------------------------------------- | -------------------------------------------- |
| 404  | `CONSULTANT_APPLICATION_NOT_FOUND`      | Application UUID does not exist.             |
| 409  | `CONSULTANT_APPLICATION_INVALID_STATUS` | Status is not `PENDING_FINAL_DECISION`.      |
| 422  | (validation)                            | `decision` not `"APPROVED"` or `"REJECTED"`. |

---

## Score Calculation Reference

| Component          | Weight | Source                                                  |
| ------------------ | ------ | ------------------------------------------------------- |
| `ai_eval_score`    | 60 %   | AI model evaluates all 30 Q&A pairs                     |
| `admin_eval_score` | 40 %   | Admin manually scores 15 questions (10 COMM + 5 SYS_KN) |

```
finalScore = (ai_eval_score × 0.6) + (admin_eval_score × 0.4)
```

**Pass threshold:** `finalScore ≥ 80`

**Copyleaks pass threshold:** aggregate AI-generation probability `< 30` (originality > 70%).

---

## Error Codes

| `error_code`                            | HTTP | Description                                                |
| --------------------------------------- | ---- | ---------------------------------------------------------- |
| `CONSULTANT_APPLICATION_NOT_FOUND`      | 404  | Application UUID not found                                 |
| `CONSULTANT_APPLICATION_INVALID_STATUS` | 409  | Requested action not valid for the current pipeline status |
