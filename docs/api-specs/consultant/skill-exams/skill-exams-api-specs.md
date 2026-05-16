# Consultant Skill Exams — Consultant endpoints

> **Source:** [src/modules/consultant-skill-exam/controllers/consultant-skill-exam.controller.ts](../../../../src/modules/consultant-skill-exam/controllers/consultant-skill-exam.controller.ts)
> **Base path:** `/api/v1/consultant/skill-exams`
> **Scope (applies to every endpoint):** Bearer auth, `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)`, `NotBannedGuard`, `OnboardingApprovedGuard`.
> **Field-name convention:** request/response payloads use **snake_case**.
> **Timezone:** send `x-timezone: <IANA>` (e.g. `Asia/Ho_Chi_Minh`). Every datetime field is rendered with the offset of that zone.

## Cross-cutting errors

| HTTP | error_code                           | When                                                                                                                             |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED`               | Missing / invalid Bearer access token.                                                                                           |
| 403  | `AUTH_ACCOUNT_INACTIVE`              | Account permanently banned. `details.ban_reason` carries the reason (e.g. `AI_CONTENT_ABUSE`). All sessions revoked at ban time. |
| 403  | `CONSULTANT_ONBOARDING_BLOCKED`      | Consultant's onboarding was rejected and the 3-month block is still in force.                                                    |
| 403  | `CONSULTANT_ONBOARDING_NOT_APPROVED` | Onboarding has not been approved yet — skill exams unlock only after admin approval.                                             |
| 403  | (platform/role)                      | Token's `active_platform` ≠ `consultant` or role ≠ `USER`.                                                                       |
| 404  | `SKILL_EXAM_NOT_FOUND`               | Exam id doesn't exist or doesn't belong to the caller (no-leak 404).                                                             |
| 409  | `SKILL_EXAM_INVALID_STATUS`          | Operation not permitted for the current status.                                                                                  |
| 422  | (validation)                         | DTO failed validation (UUIDs, lengths, etc.).                                                                                    |

---

## Endpoints

### 1. Get current exam

Return the consultant's currently active exam (any non-terminal status) — or `null` when none. The Lona dashboard uses this to render either the "you have a pending exam" card OR the "register a new exam" CTA.

- **Endpoint:** `GET /consultant/skill-exams/current`
- **Response 200:** `SkillExamSummaryResponseDto | null`

  ```json
  {
    "id": "01H8E5...",
    "skill_id": "01H8...",
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

  Lazy-expires the row if its 60-min deadline has passed before responding — the caller immediately sees the EXPIRED terminal state. `remaining_seconds` is the live count-down (only meaningful while `IN_PROGRESS`).

- **Errors:** cross-cutting only.

### 2. Eligibility check

Single source of truth for the "Start exam" button.

- **Endpoint:** `GET /consultant/skill-exams/eligibility`
- **Response 200:** `SkillExamEligibilityResponseDto`

  ```jsonc
  // Can register
  { "can_register": true, "reason": null, "details": {} }

  // Pending exam blocks registration
  { "can_register": false, "reason": "pending_exam", "details": { "pending_exam_id": "01H8E5..." } }

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

  // Onboarding not approved
  { "can_register": false, "reason": "onboarding_not_approved", "details": {} }
  ```

  Note: `OnboardingApprovedGuard` and `NotBannedGuard` short-circuit most of these branches at the controller level — the endpoint surfaces them for completeness when guards are bypassed.

- **Errors:** cross-cutting only.

### 3. Start an exam

Registers a new exam for `{ skill_id }`. The skill must already exist in the global skills catalog (admin-managed). The server enqueues `GENERATE_SKILL_EXAM_QUESTIONS`; the exam starts as `GENERATING_QUESTIONS` and transitions to `IN_PROGRESS` once the AI returns the 20 questions (typically within a few seconds, capped by the queue rate-limiter at 5 jobs/sec).

- **Endpoint:** `POST /consultant/skill-exams`
- **Body:** `StartSkillExamDto`

  ```json
  { "skill_id": "01H8E0..." }
  ```

- **Response 201:** `SkillExamSummaryResponseDto` — the freshly created row with `status: 'GENERATING_QUESTIONS'`. `expires_at` is `null` until the IN_PROGRESS transition.

- **Errors:**
  | HTTP | error_code | When |
  | ---- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
  | 403 | `SKILL_EXAM_TAKING_BLOCKED` | Platform-wide 2-day pause after 3 expired attempts. `details.blocked_until` is the ISO timestamp the pause lifts. |
  | 404 | `CONSULTANT_PROFILE_NOT_FOUND` | Should never happen — profile is created at registration. |
  | 404 | `PROJECT_SKILL_NOT_FOUND` | `skill_id` does not exist in the skills catalog. |
  | 409 | `SKILL_EXAM_ALREADY_PASSED` | Consultant already holds a PASSED exam for this skill. |
  | 409 | `SKILL_EXAM_ALREADY_IN_PROGRESS` | Consultant already has any non-terminal exam (any skill). Single-exam-at-a-time rule. |
  | 409 | `SKILL_EXAM_PARALLEL_LIMIT_REACHED` | Defence-in-depth — same root cause as the above (max 1 in-flight exam). |
  | 422 | `SKILL_EXAM_COOLDOWN_ACTIVE` | Per-skill cool-down still active from a prior fail. `details.cooldown_until` is when it lifts. |

### 4. Get exam detail

Fetch the 20 questions + the consultant's saved answers + every status field.

- **Endpoint:** `GET /consultant/skill-exams/:examId`
- **Path params:** `examId` (UUID v4)
- **Response 200:** `SkillExamDetailResponseDto`

  ```json
  {
    "id": "01H8E5...",
    "skill_id": "01H8...",
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
        "id": "01H8E6...",
        "exam_question_id": "01H8E6...",
        "question_order": 1,
        "content": "Describe your approach to building a brand-identity package…",
        "answer_text": null
      }
    ]
  }
  ```

  Lazy-expires the row if past its deadline (the response then shows `consultant_view_status: 'EXPIRED'`).

- **Errors:** cross-cutting only.

### 5. Submit a single answer (idempotent)

Saves or updates one answer. Re-submitting with the same `exam_question_id` overwrites.

- **Endpoint:** `POST /consultant/skill-exams/:examId/answers`
- **Path params:** `examId` (UUID v4)
- **Body:** `SubmitSkillExamAnswerDto`

  ```json
  {
    "exam_question_id": "01H8E6...",
    "answer_text": "I start by interviewing stakeholders, then…"
  }
  ```

- **Response 200:** `null`
- **Errors:**
  | HTTP | error_code | When |
  | ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
  | 409 | `SKILL_EXAM_INVALID_STATUS` | Exam is not in `IN_PROGRESS`. |
  | 409 | `SKILL_EXAM_EXPIRED` | The 60-min deadline has passed. Server transitions the exam to EXPIRED before responding. |

### 6. Submit the exam (finalise)

Requires all 20 answers. Transitions `IN_PROGRESS → SUBMITTED`, enqueues CopyLeaks, fires the `CONSULTANT_SKILL_EXAM_SUBMITTED` event. From the consultant's view the exam now reads `consultant_view_status: 'PENDING_REVIEW'` until the AI eval concludes.

- **Endpoint:** `POST /consultant/skill-exams/:examId/submit`
- **Path params:** `examId` (UUID v4)
- **Response 200:** `null`
- **Side effects on success:**
  1. Status → `SUBMITTED`, `submitted_at` set.
  2. Queue: `RUN_SKILL_EXAM_COPYLEAKS` job enqueued; the pipeline runs through CopyLeaks then AI eval, at the queue's 5 jobs/sec rate.
  3. Event: `CONSULTANT_SKILL_EXAM_SUBMITTED` (consultant in-app notification).
- **Errors:**
  | HTTP | error_code | When |
  | ---- | -------------------------------- | ------------------------------------------------------------------------------------- |
  | 409 | `SKILL_EXAM_INVALID_STATUS` | Exam is not in `IN_PROGRESS`. |
  | 409 | `SKILL_EXAM_EXPIRED` | Deadline has passed; server expires the exam and refuses the submit. |
  | 422 | `SKILL_EXAM_INCOMPLETE_ANSWERS` | Fewer than 20 answers saved. `details: { answered, required: 20 }`. |

---

## Timer + auto-expire

The 60-minute timer starts when the exam transitions to `IN_PROGRESS` (right after `GENERATE_SKILL_EXAM_QUESTIONS` finishes). The deadline is stored in `expires_at`. After that instant:

- **Lazy expiry**: every consultant call to `getDetail`, `submitAnswer`, `submit`, `getCurrent`, or `getEligibility` checks the deadline and forces the EXPIRED transition before the response.
- **Scheduled sweep**: a 5-minute cron (`SkillExamExpirySweeperService`) reaps any IN_PROGRESS exam past its deadline — guarantees the counter increments even if the consultant never returns.

Each EXPIRED transition increments `users.exam_expired_count`. On the 3rd EXPIRED (counter ≥ 3) the server sets `users.exam_taking_blocked_until = now + 2 days`. The counter resets when:

1. The 2-day pause expires and the consultant attempts a fresh start (`POST /consultant/skill-exams`).
2. The consultant passes any exam.

---

## Auth interaction

While the consultant's account has `users.is_active = false` (CopyLeaks 3-strike ban), every endpoint above is unreachable — every active session was revoked at ban time, so even cached JWTs immediately fail with `403 AUTH_ACCOUNT_INACTIVE`. See [auth](../auth/auth-api-specs.md) for the full ban/block matrix.
