# Consultant API — Onboarding & Skill Exams

> **Sources:**
>
> - [`src/modules/consultant-onboarding/controllers/consultant-onboarding.controller.ts`](../../../src/modules/consultant-onboarding/) _(to be implemented)_
> - [`src/modules/consultant-skill-exam/controllers/consultant-skill-exam.controller.ts`](../../../src/modules/consultant-skill-exam/) _(to be implemented)_
>
> **Base paths:** `/api/v1/consultant/onboarding` and `/api/v1/consultant/skill-exams`
> **Scope (applies to every endpoint):** Bearer auth, `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)`. Non-consultant callers receive `403`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case**.

---

## Flow overview

The consultant journey splits into **two independent gates**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GATE 1 — Onboarding (one-time, human-judged)                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Register → Verify email                                                 │
│           │                                                              │
│           ▼                                                              │
│     POST /onboarding/profile  (basic info, no skills)                    │
│           │                                                              │
│           ▼                                                              │
│     status: IN_INTERVIEW  (10 questions assigned: 5 COMM + 5 SYS_KNOW)   │
│           │                                                              │
│     POST /onboarding/interview/answers  (×10, idempotent)                │
│           │                                                              │
│     POST /onboarding/interview/submit                                    │
│           │                                                              │
│           ▼                                                              │
│     status: INTERVIEW_SUBMITTED                                          │
│     → consultant emailed; admins emailed (first TO, rest CC)             │
│           │                                                              │
│           ▼                                                              │
│     Admin reviews answers                                                │
│       ├─► APPROVED  → ConsultantProfile.isVerified=true                  │
│       │              → can register skill exams                          │
│       └─► REJECTED  → blockedUntil = now + 3 months                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (only after APPROVED)
┌──────────────────────────────────────────────────────────────────────────┐
│  GATE 2 — Skill Exams (per skill, fully automated, repeatable)           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  POST /skill-exams  { skill_id }                                         │
│           │  validates: not banned, ≤2 in-progress, cooldown clear,      │
│           │             skill not already passed                         │
│           ▼                                                              │
│     status: GENERATING_QUESTIONS  (AI job generates 20 questions)        │
│           │                                                              │
│           ▼                                                              │
│     status: IN_PROGRESS                                                  │
│           │                                                              │
│     POST /skill-exams/:examId/answers  (×20, idempotent)                 │
│           │                                                              │
│     POST /skill-exams/:examId/submit                                     │
│           │                                                              │
│           ▼                                                              │
│     status: RUNNING_COPYLEAKS                                            │
│           │                                                              │
│      ┌────┴────────────────────────────────────────────┐                 │
│      │ AI-content detected (Copyleaks aiScore > 80)    │                 │
│      ▼                                                 │                 │
│   COPYLEAKS_FAILED                                     │                 │
│    • users.aiStrikeCount += 1                          │                 │
│    • if strikes ≥ 3 → User.isActive = false,           │                 │
│      bannedAt set, banReason = AI_CONTENT_ABUSE        │                 │
│    • cooldownUntil = now + 7 days (if not banned)      │                 │
│                                                        │                 │
│      ┌─────────────────────────────────────────────────┘                 │
│      ▼                                                                   │
│   status: RUNNING_AI_EVAL  (AI scoring job)                              │
│      │                                                                   │
│      ├─► finalScore < 80      → FAILED  (cooldownUntil +7d)              │
│      ├─► 80 ≤ finalScore < 90 → PASSED  + proficiency = ADVANCED         │
│      └─► finalScore ≥ 90      → PASSED  + proficiency = EXPERT           │
│                                          + hasNotificationPriority=true  │
│                                                                          │
│  On PASSED (transactional):                                              │
│    • upsert ConsultantSkill { proficiencyLevel, rating: finalScore }     │
│    • insert ConsultantSkillScore (audit trail)                           │
│    • recompute ConsultantProfile.avgRating = AVG(rating)                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Cross-cutting errors (apply to every endpoint)

| HTTP | `error_code`                    | When                                                                                  |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`             | Missing or invalid Bearer token.                                                      |
| 401  | `AUTH_TOKEN_EXPIRED`            | Bearer token expired.                                                                 |
| 403  | `AUTH_ACCOUNT_INACTIVE`         | Account is deactivated (`User.isActive = false`) — also fires for AI-ban (3 strikes). |
| 403  | (forbidden, no error_code)      | Caller is not `UserRole.USER` or not `ActivePlatform.CONSULTANT`.                     |
| 422  | `GENERIC_VALIDATION_FAILED`     | DTO shape failures (any endpoint).                                                    |
| 500  | `GENERIC_INTERNAL_SERVER_ERROR` | Unhandled server error.                                                               |

---

# Part 1 — Onboarding endpoints

Base path: `/api/v1/consultant/onboarding`

## 1.1 Get onboarding status

- **Endpoint:** `GET /consultant/onboarding/status`
- **Description:** Returns the current onboarding row for the authenticated consultant. Returns `null` in `data` if the consultant hasn't started yet (no row).

### Response 200 — onboarding exists

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "IN_INTERVIEW",
    "decision": null,
    "rejection_note": null,
    "blocked_until": null,
    "profile_submitted_at": "2026-05-10T09:00:00.000Z",
    "interview_submitted_at": null,
    "reviewed_at": null,
    "created_at": "2026-05-10T09:00:00.000Z"
  },
  "timestamp": "2026-05-12T10:00:00.000Z",
  "path": "/api/v1/consultant/onboarding/status"
}
```

| Field                    | Type                               | Description                                                |
| ------------------------ | ---------------------------------- | ---------------------------------------------------------- |
| `id`                     | `string`                           | Onboarding UUID                                            |
| `status`                 | `OnboardingStatus`                 | See [Onboarding Status Values](#onboarding-status-values)  |
| `decision`               | `"APPROVED" \| "REJECTED" \| null` | Admin decision; `null` before review                       |
| `rejection_note`         | `string \| null`                   | Admin's free-text rejection reason; `null` unless rejected |
| `blocked_until`          | `string \| null`                   | ISO-8601 unblock date; set when `decision = REJECTED`      |
| `profile_submitted_at`   | `string \| null`                   | ISO-8601 timestamp                                         |
| `interview_submitted_at` | `string \| null`                   | ISO-8601 timestamp                                         |
| `reviewed_at`            | `string \| null`                   | ISO-8601 timestamp of admin decision                       |
| `created_at`             | `string`                           | ISO-8601                                                   |

### Response 200 — no onboarding yet

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-12T10:00:00.000Z",
  "path": "/api/v1/consultant/onboarding/status"
}
```

### Errors

Only cross-cutting (auth) errors apply.

---

## 1.2 Submit onboarding profile

- **Endpoint:** `POST /consultant/onboarding/profile`
- **Description:** Submits the consultant's basic profile. Creates a new onboarding row (or resets a row that's still in `PENDING_BASIC_INFO`), persists profile fields on `ConsultantProfile`, advances onboarding to `IN_INTERVIEW`, and **synchronously** assigns 10 questions (5 `COMMUNICATION` + 5 `SYSTEM_KNOWLEDGE`) drawn at random from the seed bank.
- **Skills are NOT supplied here.** Skills are registered later per skill via `POST /skill-exams` (see Part 2).

### Request body

```json
{
  "full_name": "Jane Doe",
  "bio": "I have 7 years of experience building scalable SaaS products...",
  "years_of_experience": 7,
  "phone_number": "+905551234567",
  "country_code": "TR",
  "avatar_url": "https://cdn.example.com/u/jane.jpg",
  "cv_url": "https://cdn.example.com/u/jane-cv.pdf"
}
```

| Field                 | Type     | Required | Constraints                                      |
| --------------------- | -------- | -------- | ------------------------------------------------ |
| `full_name`           | `string` | Yes      | 1–255 characters                                 |
| `bio`                 | `string` | Yes      | 1–5000 characters                                |
| `years_of_experience` | `number` | Yes      | Integer, 0–50                                    |
| `phone_number`        | `string` | Yes      | E.164 phone format                               |
| `country_code`        | `string` | Yes      | ISO 3166-1 alpha-2 (e.g., `TR`, `US`)            |
| `avatar_url`          | `string` | No       | Valid URL; uploaded separately via file pipeline |
| `cv_url`              | `string` | No       | Valid URL; uploaded separately via file pipeline |

### Response 200

```json
{
  "status_code": 200,
  "message": "Onboarding profile submitted. Please answer the interview questions.",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "IN_INTERVIEW",
    "decision": null,
    "rejection_note": null,
    "blocked_until": null,
    "profile_submitted_at": "2026-05-12T10:00:00.000Z",
    "interview_submitted_at": null,
    "reviewed_at": null,
    "created_at": "2026-05-12T10:00:00.000Z"
  },
  "timestamp": "2026-05-12T10:00:00.000Z",
  "path": "/api/v1/consultant/onboarding/profile"
}
```

### Errors

| HTTP | `error_code`                           | When                                                                                     |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED`        | Active 3-month block from a prior REJECTED onboarding. `details.blocked_until` ISO date. |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Onboarding already exists and status is not `PENDING_BASIC_INFO`.                        |
| 422  | `GENERIC_VALIDATION_FAILED`            | Any DTO constraint failure (e.g., `years_of_experience` < 0, invalid `phone_number`).    |

---

## 1.3 Get onboarding interview questions

- **Endpoint:** `GET /consultant/onboarding/interview`
- **Description:** Returns the 10 onboarding questions with the consultant's saved answer (if any). Only available when `status = IN_INTERVIEW`.

### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": [
    {
      "id": "oq-uuid-1",
      "onboarding_question_id": "oq-uuid-1",
      "question_order": 1,
      "type": "COMMUNICATION",
      "content": "Describe a time when you had to explain a complex technical concept to a non-technical stakeholder.",
      "answer_text": null
    },
    {
      "id": "oq-uuid-6",
      "onboarding_question_id": "oq-uuid-6",
      "question_order": 6,
      "type": "SYSTEM_KNOWLEDGE",
      "content": "Explain how you would design a rate limiter for a public API.",
      "answer_text": "I would use a token-bucket algorithm..."
    }
  ],
  "timestamp": "2026-05-12T10:00:00.000Z",
  "path": "/api/v1/consultant/onboarding/interview"
}
```

| Field                    | Type                                    | Description                                       |
| ------------------------ | --------------------------------------- | ------------------------------------------------- |
| `id`                     | `string`                                | Same as `onboarding_question_id`                  |
| `onboarding_question_id` | `string`                                | UUID to reference when submitting answers         |
| `question_order`         | `number`                                | 1–10 (1–5: COMMUNICATION, 6–10: SYSTEM_KNOWLEDGE) |
| `type`                   | `"COMMUNICATION" \| "SYSTEM_KNOWLEDGE"` | Question type                                     |
| `content`                | `string`                                | Question text                                     |
| `answer_text`            | `string \| null`                        | Saved answer, or `null` if not yet submitted      |

### Errors

| HTTP | `error_code`                           | When                                 |
| ---- | -------------------------------------- | ------------------------------------ |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`      | No onboarding exists for the caller. |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Status is not `IN_INTERVIEW`.        |

---

## 1.4 Submit an onboarding answer

- **Endpoint:** `POST /consultant/onboarding/interview/answers`
- **Description:** Saves or updates the answer to a single onboarding question. **Idempotent** — re-submitting overwrites. Allowed only while `status = IN_INTERVIEW`.

### Request body

```json
{
  "onboarding_question_id": "oq-uuid-6",
  "answer_text": "I would use a token-bucket algorithm with Redis as the backing store..."
}
```

| Field                    | Type     | Required | Constraints                   |
| ------------------------ | -------- | -------- | ----------------------------- |
| `onboarding_question_id` | `string` | Yes      | UUID of the assigned question |
| `answer_text`            | `string` | Yes      | Non-empty, 10–5000 characters |

### Response 200

```json
{
  "status_code": 200,
  "message": "Answer submitted successfully.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-12T10:00:00.000Z",
  "path": "/api/v1/consultant/onboarding/interview/answers"
}
```

### Errors

| HTTP | `error_code`                           | When                                                                      |
| ---- | -------------------------------------- | ------------------------------------------------------------------------- |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`      | No onboarding exists, or `onboarding_question_id` doesn't belong to it.   |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS` | Status is not `IN_INTERVIEW`.                                             |
| 422  | `GENERIC_VALIDATION_FAILED`            | `answer_text` length out of range or `onboarding_question_id` not a UUID. |

---

## 1.5 Finalise onboarding interview

- **Endpoint:** `POST /consultant/onboarding/interview/submit`
- **Description:** Locks the onboarding interview. Validates all 10 questions have answers, transitions to `INTERVIEW_SUBMITTED`, emails the consultant ("we're reviewing"), and emails all active admins (first admin as TO, rest as CC).

### Request body

None.

### Response 200

```json
{
  "status_code": 200,
  "message": "Onboarding submitted. You will be notified once review is complete.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-12T10:00:00.000Z",
  "path": "/api/v1/consultant/onboarding/interview/submit"
}
```

### Errors

| HTTP | `error_code`                               | When                                                                                      |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 404  | `CONSULTANT_ONBOARDING_NOT_FOUND`          | No onboarding exists.                                                                     |
| 409  | `CONSULTANT_ONBOARDING_INVALID_STATUS`     | Status is not `IN_INTERVIEW`.                                                             |
| 422  | `CONSULTANT_ONBOARDING_INCOMPLETE_ANSWERS` | Fewer than 10 answers saved. `details.answered` and `details.required` indicate progress. |

---

# Part 2 — Skill Exam endpoints

Base path: `/api/v1/consultant/skill-exams`

> **Additional guards** beyond the cross-cutting set: `OnboardingApprovedGuard` (onboarding must be `APPROVED`) and `NotBannedGuard` (`User.bannedAt` must be null).

## 2.1 List my skill exams

- **Endpoint:** `GET /consultant/skill-exams`
- **Description:** Returns every skill exam the consultant has attempted, newest first. Includes in-progress, passed, and failed attempts.

### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": [
    {
      "id": "exam-uuid-2",
      "skill_id": "skill-uuid-react",
      "status": "PASSED",
      "attempt_number": 1,
      "ai_eval_score": "92.50",
      "correct_count": 18,
      "assigned_proficiency": "expert",
      "cooldown_until": null,
      "fail_reason": null,
      "started_at": "2026-05-12T10:00:00.000Z",
      "submitted_at": "2026-05-12T11:30:00.000Z",
      "concluded_at": "2026-05-12T11:35:00.000Z",
      "created_at": "2026-05-12T10:00:00.000Z"
    },
    {
      "id": "exam-uuid-1",
      "skill_id": "skill-uuid-nodejs",
      "status": "FAILED",
      "attempt_number": 1,
      "ai_eval_score": "62.00",
      "correct_count": 11,
      "assigned_proficiency": null,
      "cooldown_until": "2026-05-19T11:35:00.000Z",
      "fail_reason": "LOW_SCORE",
      "started_at": "2026-05-12T09:00:00.000Z",
      "submitted_at": "2026-05-12T10:00:00.000Z",
      "concluded_at": "2026-05-12T10:05:00.000Z",
      "created_at": "2026-05-12T09:00:00.000Z"
    }
  ],
  "timestamp": "2026-05-12T12:00:00.000Z",
  "path": "/api/v1/consultant/skill-exams"
}
```

| Field                  | Type                                        | Description                                                                              |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`                   | `string`                                    | Exam UUID                                                                                |
| `skill_id`             | `string`                                    | Skill UUID                                                                               |
| `status`               | `SkillExamStatus`                           | See [Skill Exam Status Values](#skill-exam-status-values)                                |
| `attempt_number`       | `number`                                    | 1-based retry counter for `(consultant, skill)`                                          |
| `ai_eval_score`        | `string \| null`                            | Numeric `0.00–100.00`; set when status reaches `PASSED` or `FAILED` via AI eval          |
| `correct_count`        | `number \| null`                            | `0–20`; number of answers AI judged correct (`isCorrect = true`)                         |
| `assigned_proficiency` | `"advanced" \| "expert" \| null`            | Assigned on PASS based on score (80–89 → advanced; ≥90 → expert)                         |
| `cooldown_until`       | `string \| null`                            | ISO-8601 — when the consultant may retake this skill (failed exams only; `now + 7 days`) |
| `fail_reason`          | `"LOW_SCORE" \| "COPYLEAKS_FAILED" \| null` | Set on FAILED/COPYLEAKS_FAILED                                                           |
| `started_at`           | `string \| null`                            | ISO-8601 — when AI question generation completed                                         |
| `submitted_at`         | `string \| null`                            | ISO-8601 — when consultant called `/submit`                                              |
| `concluded_at`         | `string \| null`                            | ISO-8601 — when final status (PASSED/FAILED/COPYLEAKS_FAILED) was set                    |
| `created_at`           | `string`                                    | ISO-8601                                                                                 |

### Errors

| HTTP | `error_code`                         | When                                                       |
| ---- | ------------------------------------ | ---------------------------------------------------------- |
| 403  | `CONSULTANT_ONBOARDING_NOT_APPROVED` | Caller's onboarding has not been approved by an admin yet. |
| 403  | `SKILL_EXAM_USER_BANNED`             | `User.bannedAt` is set (3 AI-content strikes).             |

---

## 2.2 Start a new skill exam

- **Endpoint:** `POST /consultant/skill-exams`
- **Description:** Registers a skill and starts a new exam attempt. Enqueues `GENERATE_SKILL_EXAM_QUESTIONS` (AI generates 20 questions). The exam is in `GENERATING_QUESTIONS` until the job completes, then `IN_PROGRESS`.

### Preconditions (validated server-side)

1. Onboarding `status = APPROVED`.
2. `User.bannedAt` is null.
3. Caller has **fewer than 2** skill exams currently in-progress (statuses: `GENERATING_QUESTIONS`, `IN_PROGRESS`, `SUBMITTED`, `RUNNING_COPYLEAKS`, `RUNNING_AI_EVAL`).
4. Skill exists in the `skills` catalogue.
5. The latest exam for `(consultant, skill_id)`:
   - is not currently `PASSED` (skill already mastered),
   - is not currently in-progress (one in-flight attempt per skill),
   - has `cooldown_until ≤ now` (failed retake cooldown elapsed).

### Request body

```json
{
  "skill_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field      | Type     | Required | Constraints                               |
| ---------- | -------- | -------- | ----------------------------------------- |
| `skill_id` | `string` | Yes      | UUID of a skill in the `skills` catalogue |

### Response 201

```json
{
  "status_code": 201,
  "message": "Skill exam started. Questions are being generated.",
  "error_code": null,
  "data": {
    "id": "exam-uuid-new",
    "skill_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "GENERATING_QUESTIONS",
    "attempt_number": 2,
    "created_at": "2026-05-12T12:00:00.000Z"
  },
  "timestamp": "2026-05-12T12:00:00.000Z",
  "path": "/api/v1/consultant/skill-exams"
}
```

### Errors

| HTTP | `error_code`                         | When                                                                                                           |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 403  | `CONSULTANT_ONBOARDING_NOT_APPROVED` | Caller's onboarding is not yet `APPROVED`.                                                                     |
| 403  | `SKILL_EXAM_USER_BANNED`             | Caller is permanently banned (`User.bannedAt` set).                                                            |
| 404  | `PROJECT_SKILL_NOT_FOUND`            | `skill_id` does not exist in the catalogue.                                                                    |
| 409  | `SKILL_EXAM_ALREADY_PASSED`          | Caller already has a `PASSED` exam for this skill.                                                             |
| 409  | `SKILL_EXAM_ALREADY_IN_PROGRESS`     | Caller has an in-progress exam for this skill.                                                                 |
| 409  | `SKILL_EXAM_PARALLEL_LIMIT_REACHED`  | Caller already has 2 exams in progress (max).                                                                  |
| 422  | `SKILL_EXAM_COOLDOWN_ACTIVE`         | Caller's last attempt failed; cooldown not yet expired. `details.cooldown_until` is the ISO unblock timestamp. |
| 422  | `GENERIC_VALIDATION_FAILED`          | `skill_id` is not a UUID.                                                                                      |

---

## 2.3 Get a skill exam (questions + saved answers)

- **Endpoint:** `GET /consultant/skill-exams/:examId`
- **Description:** Returns the exam with its 20 questions and the consultant's saved answer for each. Only meaningful while `status = IN_PROGRESS`; other statuses return an empty questions array and the terminal score fields.

### Response 200

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "exam-uuid-new",
    "skill_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "IN_PROGRESS",
    "attempt_number": 1,
    "ai_eval_score": null,
    "correct_count": null,
    "assigned_proficiency": null,
    "started_at": "2026-05-12T12:01:00.000Z",
    "submitted_at": null,
    "concluded_at": null,
    "questions": [
      {
        "id": "eq-uuid-1",
        "exam_question_id": "eq-uuid-1",
        "question_order": 1,
        "content": "Explain the difference between useMemo and useCallback in React.",
        "answer_text": null
      }
    ]
  },
  "timestamp": "2026-05-12T12:05:00.000Z",
  "path": "/api/v1/consultant/skill-exams/exam-uuid-new"
}
```

| Field (under `data.questions[]`) | Type             | Description                                  |
| -------------------------------- | ---------------- | -------------------------------------------- |
| `id`                             | `string`         | Same as `exam_question_id`                   |
| `exam_question_id`               | `string`         | UUID to reference when submitting answers    |
| `question_order`                 | `number`         | 1–20                                         |
| `content`                        | `string`         | Question text (AI-generated for this skill)  |
| `answer_text`                    | `string \| null` | Saved answer, or `null` if not yet submitted |

### Errors

| HTTP | `error_code`                         | When                                                         |
| ---- | ------------------------------------ | ------------------------------------------------------------ |
| 403  | `CONSULTANT_ONBOARDING_NOT_APPROVED` | Caller's onboarding is not approved.                         |
| 403  | `SKILL_EXAM_USER_BANNED`             | Caller is banned.                                            |
| 404  | `SKILL_EXAM_NOT_FOUND`               | No exam with this ID, or exam belongs to another consultant. |

---

## 2.4 Submit an answer to a skill-exam question

- **Endpoint:** `POST /consultant/skill-exams/:examId/answers`
- **Description:** Saves or updates the answer for one question. **Idempotent** — re-submitting overwrites. Allowed only while `status = IN_PROGRESS`.

### Request body

```json
{
  "exam_question_id": "eq-uuid-1",
  "answer_text": "useMemo memoizes a computed value; useCallback memoizes a function reference..."
}
```

| Field              | Type     | Required | Constraints                   |
| ------------------ | -------- | -------- | ----------------------------- |
| `exam_question_id` | `string` | Yes      | UUID of an assigned question  |
| `answer_text`      | `string` | Yes      | Non-empty, 10–5000 characters |

### Response 200

```json
{
  "status_code": 200,
  "message": "Answer submitted successfully.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-12T12:30:00.000Z",
  "path": "/api/v1/consultant/skill-exams/exam-uuid-new/answers"
}
```

### Errors

| HTTP | `error_code`                         | When                                                                |
| ---- | ------------------------------------ | ------------------------------------------------------------------- |
| 403  | `CONSULTANT_ONBOARDING_NOT_APPROVED` | Caller's onboarding is not approved.                                |
| 403  | `SKILL_EXAM_USER_BANNED`             | Caller is banned.                                                   |
| 404  | `SKILL_EXAM_NOT_FOUND`               | No exam with this ID, or `exam_question_id` does not belong to it.  |
| 409  | `SKILL_EXAM_INVALID_STATUS`          | Exam status is not `IN_PROGRESS`.                                   |
| 422  | `GENERIC_VALIDATION_FAILED`          | `answer_text` length out of range or `exam_question_id` not a UUID. |

---

## 2.5 Finalise a skill exam

- **Endpoint:** `POST /consultant/skill-exams/:examId/submit`
- **Description:** Locks the exam. Validates all 20 answers are present, transitions to `SUBMITTED`, and enqueues `RUN_SKILL_EXAM_COPYLEAKS`. The consultant is notified by email when the final status is reached.

### Request body

None.

### Response 200

```json
{
  "status_code": 200,
  "message": "Skill exam submitted. You will be notified once evaluation is complete.",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-12T13:00:00.000Z",
  "path": "/api/v1/consultant/skill-exams/exam-uuid-new/submit"
}
```

### Errors

| HTTP | `error_code`                         | When                                                                                  |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| 403  | `CONSULTANT_ONBOARDING_NOT_APPROVED` | Caller's onboarding is not approved.                                                  |
| 403  | `SKILL_EXAM_USER_BANNED`             | Caller is banned.                                                                     |
| 404  | `SKILL_EXAM_NOT_FOUND`               | No exam with this ID, or exam belongs to another consultant.                          |
| 409  | `SKILL_EXAM_INVALID_STATUS`          | Status is not `IN_PROGRESS`.                                                          |
| 422  | `SKILL_EXAM_INCOMPLETE_ANSWERS`      | Fewer than 20 answers saved. `details.answered` and `details.required` show progress. |

---

# Reference

## Onboarding Status Values

| Value                 | Description                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `PENDING_BASIC_INFO`  | User exists but has not submitted `POST /onboarding/profile` yet.                                    |
| `IN_INTERVIEW`        | 10 onboarding questions assigned; consultant is answering.                                           |
| `INTERVIEW_SUBMITTED` | All 10 answers submitted; awaiting admin manual review.                                              |
| `APPROVED`            | Admin approved. `ConsultantProfile.isVerified = true`. Consultant can now register skill exams.      |
| `REJECTED`            | Admin rejected. `blocked_until = now + 3 months`. Consultant can re-register after the block lapses. |

## Skill Exam Status Values

| Value                  | Description                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `GENERATING_QUESTIONS` | AI is generating the 20 questions for this skill.                                                         |
| `IN_PROGRESS`          | Questions ready; consultant is answering.                                                                 |
| `SUBMITTED`            | All 20 answers submitted; Copyleaks job queued.                                                           |
| `RUNNING_COPYLEAKS`    | Copyleaks AI-content check running.                                                                       |
| `COPYLEAKS_FAILED`     | AI-generated content detected. Strike counter incremented; ban if ≥3 lifetime strikes.                    |
| `RUNNING_AI_EVAL`      | Copyleaks passed; AI scoring job running.                                                                 |
| `PASSED`               | Score ≥80. `ConsultantSkill` row written with proficiency + rating; `avgRating` recomputed.               |
| `FAILED`               | Score <80. `cooldown_until = now + 7 days`. Consultant may retake after cooldown with fresh AI questions. |

## Pass / Fail / Benefit thresholds

| Final % score       | Outcome                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `< 80%`             | `FAILED` — `fail_reason = LOW_SCORE`, `cooldown_until = now + 7 days`                                                                                |
| `80% ≤ score < 90%` | `PASSED` — `assigned_proficiency = "advanced"`                                                                                                       |
| `≥ 90%`             | `PASSED` — `assigned_proficiency = "expert"` + `ConsultantProfile.hasNotificationPriority = true` (priority tier on new-project notification emails) |

## AI-content strike policy

| Strike # | Outcome                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Exam `COPYLEAKS_FAILED`, `cooldown_until = now + 7 days`, `users.aiStrikeCount = 1`. Other skills unaffected.                                                                                                                |
| 2        | Same as #1 with `users.aiStrikeCount = 2`.                                                                                                                                                                                   |
| 3        | Same as #1 with `users.aiStrikeCount = 3` **PLUS** `User.isActive = false`, `User.bannedAt = now`, `User.banReason = "AI_CONTENT_ABUSE"`. Account locked platform-wide; all future calls return `403 AUTH_ACCOUNT_INACTIVE`. |

The strike counter is **lifetime** — it never resets.

## Error Codes (full catalogue for these endpoints)

| `error_code`                               | HTTP | Description                                                                         |
| ------------------------------------------ | ---- | ----------------------------------------------------------------------------------- |
| `CONSULTANT_ONBOARDING_NOT_FOUND`          | 404  | No onboarding row for the caller.                                                   |
| `CONSULTANT_ONBOARDING_BLOCKED`            | 403  | Caller is under a 3-month onboarding block; `details.blocked_until` provided.       |
| `CONSULTANT_ONBOARDING_INVALID_STATUS`     | 409  | Onboarding status does not allow the requested action.                              |
| `CONSULTANT_ONBOARDING_INCOMPLETE_ANSWERS` | 422  | Fewer than 10 onboarding answers; `details.answered` / `details.required` provided. |
| `CONSULTANT_ONBOARDING_NOT_APPROVED`       | 403  | Caller tried a skill-exam endpoint before onboarding was admin-approved.            |
| `SKILL_EXAM_NOT_FOUND`                     | 404  | No exam with this ID, or exam belongs to another consultant.                        |
| `SKILL_EXAM_USER_BANNED`                   | 403  | Caller is permanently banned for AI-content abuse.                                  |
| `SKILL_EXAM_ALREADY_PASSED`                | 409  | Caller already has a passed exam for this skill.                                    |
| `SKILL_EXAM_ALREADY_IN_PROGRESS`           | 409  | Caller already has an in-progress exam for this skill.                              |
| `SKILL_EXAM_PARALLEL_LIMIT_REACHED`        | 409  | Caller already has 2 exams in-progress (max).                                       |
| `SKILL_EXAM_COOLDOWN_ACTIVE`               | 422  | Retake cooldown not yet expired; `details.cooldown_until` provided.                 |
| `SKILL_EXAM_INVALID_STATUS`                | 409  | Exam status does not allow the requested action.                                    |
| `SKILL_EXAM_INCOMPLETE_ANSWERS`            | 422  | Fewer than 20 answers; `details.answered` / `details.required` provided.            |
| `SKILL_EXAM_NOT_READY`                     | 409  | Exam status is `GENERATING_QUESTIONS`; questions are not ready yet.                 |

## Notes on idempotency, timing, and side effects

- `POST /onboarding/interview/answers` and `POST /skill-exams/:examId/answers` are upserts keyed on `(question_id)` within the row — safe to retry.
- `POST /onboarding/profile` is **not** idempotent — calling twice while in `PENDING_BASIC_INFO` creates a single onboarding row on the first call, then returns `CONSULTANT_ONBOARDING_INVALID_STATUS` on subsequent calls.
- `POST /onboarding/interview/submit` and `POST /skill-exams/:examId/submit` are one-shot — once status moves past the gate, subsequent calls return `CONSULTANT_ONBOARDING_INVALID_STATUS` or `SKILL_EXAM_INVALID_STATUS`.
- Skill-exam question generation, Copyleaks scoring, and AI evaluation are async via the `consultant-skill-exam` Bull queue. Consultants poll `GET /skill-exams/:examId` to observe status transitions, or wait for the completion email.
- Admin notification emails use a **TO=first admin, CC=rest** dispatch pattern (one thread per onboarding/exam event).
