# Consultant Skill Exams — Consultant endpoints

> **Source:** [apps/consultant-service/src/modules/consultant-skill-exam/controllers/consultant-skill-exam.controller.ts](../../../../apps/consultant-service/src/modules/consultant-skill-exam/controllers/consultant-skill-exam.controller.ts)
> **Base path:** `/api/v1/consultant/skill-exams`
> **Scope (applies to every endpoint):** `@ApiBearerAuth()`, `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)`, `RolesGuard`, `PlatformGuard`, `NotBannedGuard`, `OnboardingApprovedGuard`.
> **Field-name convention:** request/response payloads use **snake_case**.
> **Timezone:** send `x-timezone: <IANA>` (e.g. `Asia/Ho_Chi_Minh`). Every datetime field is rendered with the offset of that zone; absent → UTC.

## Throttling

The controller is decorated with `@Throttle(THROTTLE_DEFAULT)` (60 req / 60 s) and the three write endpoints override with `@Throttle(THROTTLE_MODERATE)` (10 req / 60 s):

| Endpoint                | Tier       | Limit     |
| ----------------------- | ---------- | --------- |
| `GET /current`          | `DEFAULT`  | 60 / 60 s |
| `GET /eligibility`      | `DEFAULT`  | 60 / 60 s |
| `GET /:examId`          | `DEFAULT`  | 60 / 60 s |
| `POST /` (start)        | `MODERATE` | 10 / 60 s |
| `POST /:examId/answers` | `MODERATE` | 10 / 60 s |
| `POST /:examId/submit`  | `MODERATE` | 10 / 60 s |

Exceeding the limit returns `429 AUTH_RATE_LIMITED`.

## Cross-cutting errors

| HTTP | `error_code`                         | When                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`               | Missing / invalid Bearer access token.                                                                                                                                                                                                                           |
| 403  | `SKILL_EXAM_USER_BANNED`             | `NotBannedGuard` — `users.banned_at` is set on the caller. `details.ban_reason` carries the reason (e.g. `AI_CONTENT_ABUSE`). Triggered by the 3rd CopyLeaks strike. Sessions are revoked at ban time, so a cached JWT typically fails the session lookup first. |
| 403  | `CONSULTANT_ONBOARDING_NOT_APPROVED` | `OnboardingApprovedGuard` — onboarding row missing or status ≠ `APPROVED`.                                                                                                                                                                                       |
| 403  | `GENERIC_FORBIDDEN`                  | `PlatformGuard` / `RolesGuard` — token's `active_platform` ≠ `consultant` or role ≠ `USER`.                                                                                                                                                                      |
| 404  | `SKILL_EXAM_NOT_FOUND`               | Exam id doesn't exist, doesn't belong to the caller, or (for `/answers`) the supplied `exam_question_id` does not belong to that exam. (Single error code: no-leak 404.)                                                                                         |
| 422  | `GENERIC_VALIDATION_FAILED`          | DTO failed class-validator validation.                                                                                                                                                                                                                           |
| 429  | `AUTH_RATE_LIMITED`                  | Endpoint-specific throttle exceeded.                                                                                                                                                                                                                             |

> The `CONSULTANT_ONBOARDING_BLOCKED` (3-month admin-rejection block) does **not** reach these endpoints — it is enforced at the auth layer, so the consultant cannot sign in to obtain a token in the first place. See [auth-api-specs.md](../identity-service/auth/auth-api-specs.md).

---

## Endpoints

### 1. Get current exam

Return the consultant's currently active exam (any non-terminal status) — or `null` when none. The Lonaos dashboard uses this to render either the "you have a pending exam" card OR the "register a new exam" CTA.

- **Endpoint:** `GET /consultant/skill-exams/current`
- **Throttle:** `DEFAULT` (60 / 60 s)
- **Response 200:** `SkillExamSummaryResponseDto | null` (`data` is `null` when there is no active exam — the envelope is still wrapped normally)

  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "skill_id": "550e8400-e29b-41d4-a716-446655440001",
    "skill_name": "graphic_design",
    "status": "IN_PROGRESS",
    "consultant_view_status": "IN_PROGRESS",
    "attempt_number": 1,
    "ai_eval_score": null,
    "correct_count": null,
    "assigned_proficiency": null,
    "cooldown_until": null,
    "fail_reason": null,
    "started_at": "2026-05-14T16:11:00.000+07:00",
    "expires_at": "2026-05-14T17:11:00.000+07:00",
    "remaining_seconds": 3540,
    "submitted_at": null,
    "concluded_at": null,
    "created_at": "2026-05-14T16:10:30.000+07:00"
  }
  ```

  Lazy-expires the row if its 60-min deadline has passed before responding — the caller immediately sees the EXPIRED terminal state. `remaining_seconds` is the live count-down (only meaningful while `IN_PROGRESS`; otherwise `null`).

- **Errors:** cross-cutting only.

### 2. Eligibility check

Single source of truth for the "Start exam" button.

- **Endpoint:** `GET /consultant/skill-exams/eligibility`
- **Throttle:** `DEFAULT` (60 / 60 s)
- **Response 200:** `SkillExamEligibilityResponseDto`

  ```jsonc
  // Can register
  { "can_register": true, "reason": null, "details": {} }

  // Pending exam blocks registration
  { "can_register": false, "reason": "pending_exam", "details": { "pending_exam_id": "550e8400-e29b-41d4-a716-446655440000" } }

  // Platform-wide 2-day pause after 3 expired attempts
  {
    "can_register": false,
    "reason": "platform_block",
    "details": {
      "blocked_until": "2026-05-16T16:11:00.000+07:00",
      "exam_expired_count": 3
    }
  }

  // Permanently banned (CopyLeaks 3-strike)
  { "can_register": false, "reason": "banned", "details": { "ban_reason": "AI_CONTENT_ABUSE" } }

  // Onboarding not approved or consultant profile missing
  { "can_register": false, "reason": "onboarding_not_approved", "details": {} }
  ```

  `reason` is one of: `"pending_exam" | "platform_block" | "banned" | "onboarding_not_approved" | null`.

  Note: `OnboardingApprovedGuard` and `NotBannedGuard` short-circuit the `banned` / `onboarding_not_approved` branches at the controller level — the endpoint surfaces them for completeness in case guards are bypassed.

- **Errors:** cross-cutting only.

### 3. Start an exam

Registers a new exam for `{ skill_id }`. The skill must already exist in the global skills catalog (admin-managed). The server enqueues `GENERATE_SKILL_EXAM_QUESTIONS`; the exam starts as `GENERATING_QUESTIONS` and transitions to `IN_PROGRESS` once the AI returns the 20 questions (typically within a few seconds, capped by the queue rate-limiter at 5 jobs/sec).

- **Endpoint:** `POST /consultant/skill-exams`
- **Throttle:** `MODERATE` (10 / 60 s)
- **Request body:** `StartSkillExamDto`

  ```json
  { "skill_id": "550e8400-e29b-41d4-a716-446655440001" }
  ```

  | Field      | Type     | Constraints                              |
  | ---------- | -------- | ---------------------------------------- |
  | `skill_id` | `string` | UUID; must exist in the `skills` catalog |

- **Response 201:** `SkillExamSummaryResponseDto` — the freshly created row with `status: "GENERATING_QUESTIONS"`. `started_at`, `expires_at`, and `remaining_seconds` are `null` until the IN_PROGRESS transition.
- **Side effects on success:**
  1. New `consultant_skill_exams` row, `attempt_number = previousAttempts + 1`.
  2. If the consultant just came off a platform block (counter ≥ 3 and `exam_taking_blocked_until` has elapsed), `exam_expired_count` and `exam_taking_blocked_until` are reset on the user row in the same transaction.
  3. Queue: `GENERATE_SKILL_EXAM_QUESTIONS` job enqueued; the worker writes `started_at` + `expires_at = started_at + 60 min` when it flips the row to `IN_PROGRESS`.

- **Errors:**

  | HTTP | `error_code`                        | When                                                                                                                                                                                       |
  | ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | 403  | `SKILL_EXAM_TAKING_BLOCKED`         | Platform-wide 2-day pause after 3 expired attempts. `details.blocked_until` is the ISO timestamp the pause lifts.                                                                          |
  | 404  | `AUTH_USER_NOT_FOUND`               | User row missing (defence-in-depth — should never happen for an authenticated caller).                                                                                                     |
  | 404  | `CONSULTANT_PROFILE_NOT_FOUND`      | Consultant profile missing — should never happen, profile is created at registration.                                                                                                      |
  | 404  | `PROJECT_SKILL_NOT_FOUND`           | `skill_id` does not exist in the skills catalog.                                                                                                                                           |
  | 409  | `SKILL_EXAM_ALREADY_PASSED`         | Consultant already holds a PASSED exam for this skill.                                                                                                                                     |
  | 409  | `SKILL_EXAM_ALREADY_IN_PROGRESS`    | Consultant already has any non-terminal exam **for this skill** (GENERATING_QUESTIONS / IN_PROGRESS / SUBMITTED / RUNNING_COPYLEAKS / RUNNING_AI_EVAL).                                    |
  | 409  | `SKILL_EXAM_PARALLEL_LIMIT_REACHED` | Consultant already has any non-terminal exam **for any skill**. Single-exam-at-a-time rule (`MAX_PARALLEL_EXAMS = 1`); checked across all skills before the per-skill check.               |
  | 422  | `SKILL_EXAM_COOLDOWN_ACTIVE`        | Per-skill cool-down still active from a prior fail. `details.cooldown_until` is the ISO timestamp it lifts. Cool-down length is 30 days for `LOW_SCORE` and 7 days for `COPYLEAKS_FAILED`. |

### 4. Get exam detail

Fetch the 20 questions + the consultant's saved answers + every status field.

- **Endpoint:** `GET /consultant/skill-exams/:examId`
- **Throttle:** `DEFAULT` (60 / 60 s)
- **Path params:** `examId` (UUID — validated by `ParseUUIDPipe`)
- **Response 200:** `SkillExamDetailResponseDto` — `SkillExamSummaryResponseDto` + `questions[]`

  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "skill_id": "550e8400-e29b-41d4-a716-446655440001",
    "skill_name": "graphic_design",
    "status": "IN_PROGRESS",
    "consultant_view_status": "IN_PROGRESS",
    "attempt_number": 1,
    "ai_eval_score": null,
    "correct_count": null,
    "assigned_proficiency": null,
    "cooldown_until": null,
    "fail_reason": null,
    "started_at": "2026-05-14T16:11:00.000+07:00",
    "expires_at": "2026-05-14T17:11:00.000+07:00",
    "remaining_seconds": 3540,
    "submitted_at": null,
    "concluded_at": null,
    "created_at": "2026-05-14T16:10:30.000+07:00",
    "questions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "exam_question_id": "550e8400-e29b-41d4-a716-446655440010",
        "question_order": 1,
        "content": "Describe your approach to building a brand-identity package…",
        "answer_text": null
      }
    ]
  }
  ```

  Each `questions[]` entry includes `answer_text` — the latest saved answer for that question (or `null` if untouched). The list returns up to `TOTAL_SKILL_EXAM_QUESTIONS = 20` items once questions have been generated.

  Lazy-expires the row if past its deadline (the response then shows `consultant_view_status: "EXPIRED"`).

- **Errors:** cross-cutting only (`SKILL_EXAM_NOT_FOUND` when the id is unknown or not owned by the caller).

### 5. Submit a single answer (idempotent)

Saves or updates one answer. Re-submitting with the same `exam_question_id` overwrites the existing row.

- **Endpoint:** `POST /consultant/skill-exams/:examId/answers`
- **Throttle:** `MODERATE` (10 / 60 s)
- **Path params:** `examId` (UUID)
- **Request body:** `SubmitSkillExamAnswerDto`

  ```json
  {
    "exam_question_id": "550e8400-e29b-41d4-a716-446655440010",
    "answer_text": "I start by interviewing stakeholders, then…"
  }
  ```

  | Field              | Type     | Constraints                        |
  | ------------------ | -------- | ---------------------------------- |
  | `exam_question_id` | `string` | UUID; must belong to the same exam |
  | `answer_text`      | `string` | 10–5000 characters                 |

- **Response 200:** `data: null`.
- **Errors:**

  | HTTP | `error_code`                | When                                                                                             |
  | ---- | --------------------------- | ------------------------------------------------------------------------------------------------ |
  | 404  | `SKILL_EXAM_NOT_FOUND`      | Exam id unknown, not owned by the caller, or `exam_question_id` does not belong to the exam.     |
  | 409  | `SKILL_EXAM_EXPIRED`        | The 60-min deadline has passed. Server transitions the exam to `EXPIRED` before responding.      |
  | 409  | `SKILL_EXAM_INVALID_STATUS` | Exam is not in `IN_PROGRESS` (e.g. still `GENERATING_QUESTIONS`, already `SUBMITTED`, terminal). |
  | 422  | `GENERIC_VALIDATION_FAILED` | DTO validation failed (UUID shape, `answer_text` length).                                        |

### 6. Submit the exam (finalise)

Requires all 20 answers. Transitions `IN_PROGRESS → SUBMITTED`, enqueues the CopyLeaks → AI-eval pipeline, and fires the `CONSULTANT_SKILL_EXAM_SUBMITTED` event. From the consultant's view the exam now reads `consultant_view_status: "PENDING_REVIEW"` until the AI eval concludes.

- **Endpoint:** `POST /consultant/skill-exams/:examId/submit`
- **Throttle:** `MODERATE` (10 / 60 s)
- **Path params:** `examId` (UUID)
- **Request body:** _none_
- **Response 200:** `data: null`.
- **Side effects on success:**
  1. Status → `SUBMITTED`, `submitted_at` set.
  2. Queue: `RUN_SKILL_EXAM_COPYLEAKS` job enqueued; the pipeline runs through CopyLeaks then AI eval, at the queue's 5 jobs/sec rate.
  3. Event: `CONSULTANT_SKILL_EXAM_SUBMITTED` (consultant in-app notification + admin fan-out).
- **Errors:**

  | HTTP | `error_code`                    | When                                                                 |
  | ---- | ------------------------------- | -------------------------------------------------------------------- |
  | 404  | `SKILL_EXAM_NOT_FOUND`          | Exam id unknown or not owned by the caller.                          |
  | 409  | `SKILL_EXAM_EXPIRED`            | Deadline has passed; server expires the exam and refuses the submit. |
  | 409  | `SKILL_EXAM_INVALID_STATUS`     | Exam is not in `IN_PROGRESS`.                                        |
  | 422  | `SKILL_EXAM_INCOMPLETE_ANSWERS` | Fewer than 20 answers saved. `details: { answered, required: 20 }`.  |

---

## Status enums

### `status` — raw internal `SkillExamStatus`

`GENERATING_QUESTIONS` · `IN_PROGRESS` · `SUBMITTED` · `RUNNING_COPYLEAKS` · `COPYLEAKS_FAILED` · `RUNNING_AI_EVAL` · `PASSED` · `FAILED` · `EXPIRED`

The non-terminal set (`SKILL_EXAM_IN_PROGRESS_STATUSES`) — used by the start gate and eligibility — is `{GENERATING_QUESTIONS, IN_PROGRESS, SUBMITTED, RUNNING_COPYLEAKS, RUNNING_AI_EVAL}`. `PASSED`, `FAILED`, `EXPIRED`, and `COPYLEAKS_FAILED` are terminal.

### `consultant_view_status` — `ConsultantViewSkillExamStatus`

Hides the back-of-house CopyLeaks/AI-eval transitions behind a single `PENDING_REVIEW` value so the Lonaos UI shows a steady "waiting for review" state from submit through to terminal verdict:

`GENERATING_QUESTIONS` · `IN_PROGRESS` · `PENDING_REVIEW` · `EXPIRED` · `COPYLEAKS_FAILED` · `FAILED` · `PASSED`

Mapping: `SUBMITTED` / `RUNNING_COPYLEAKS` / `RUNNING_AI_EVAL` → `PENDING_REVIEW`; everything else is passed through unchanged.

### `fail_reason` — `SkillExamFailReason`

`LOW_SCORE` · `COPYLEAKS_FAILED` · `EXPIRED`

### `assigned_proficiency`

Written by the AI eval on a `PASSED` row. Possible values: `BEGINNER` · `INTERMEDIATE` · `SENIOR` · `EXPERT`. Score bands (0–100):

| Band           | Range     | Outcome                |
| -------------- | --------- | ---------------------- |
| `BEGINNER`     | `< 40`    | `FAILED` (`LOW_SCORE`) |
| `INTERMEDIATE` | `40 – 79` | `FAILED` (`LOW_SCORE`) |
| `SENIOR`       | `80 – 89` | `PASSED`               |
| `EXPERT`       | `≥ 90`    | `PASSED`               |

---

## Timer + auto-expire

The 60-minute timer starts when the exam transitions to `IN_PROGRESS` (right after `GENERATE_SKILL_EXAM_QUESTIONS` finishes). The deadline is stored in `expires_at`. After that instant:

- **Lazy expiry**: every consultant call to `getCurrent`, `getEligibility`, `getDetail`, `submitAnswer`, or `submit` checks the deadline and forces the EXPIRED transition before responding. `submitAnswer` and `submit` additionally reject the call with `409 SKILL_EXAM_EXPIRED`.
- **Scheduled sweep**: a 5-minute cron (`SkillExamExpirySweeperService`) reaps any `IN_PROGRESS` exam past its deadline — guarantees the counter increments even if the consultant never returns.

Each EXPIRED transition increments `users.exam_expired_count`. On the 3rd EXPIRED (`EXPIRED_RETRY_LIMIT = 3`) the server sets `users.exam_taking_blocked_until = now + 2 days` (`EXAM_TAKING_COOLDOWN_DAYS = 2`). The counter resets when:

1. The 2-day pause expires and the consultant attempts a fresh start (`POST /consultant/skill-exams`).
2. The consultant passes any exam.

---

## Auth interaction

While the consultant's account has `users.is_active = false` (CopyLeaks 3-strike ban), every endpoint above is unreachable — every active session was revoked at ban time, so even cached JWTs immediately fail their session lookup. If a request somehow survives long enough to reach the controller, `NotBannedGuard` rejects it with `403 SKILL_EXAM_USER_BANNED` (`details.ban_reason`). See [auth-api-specs.md](../identity-service/auth/auth-api-specs.md) for the full ban/block matrix.
