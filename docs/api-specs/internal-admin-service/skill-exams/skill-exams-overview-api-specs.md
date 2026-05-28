# Consultant Skill Exams — API Specs

Per-skill, fully automated competency exam. The consultant registers a skill, AI generates 20 questions, the consultant has **60 minutes** to answer them, CopyLeaks gates AI-generated content, AI grades the answers, and a 4-tier proficiency level (BEGINNER / INTERMEDIATE / SENIOR / EXPERT) is assigned.

**Base path:** `/api/v1`
**Response envelope:** every endpoint is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. Per-endpoint examples below show only the `data` portion unless the error envelope matters.
**Field naming:** JSON contract is **snake_case**.

## Audiences

| File                                                                     | Audience                | Covers                                                                 |
| ------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------- |
| [consultant](../consultant-service/skill-exams/skill-exams-api-specs.md) | Consultant (Lonaos app) | Register, view current exam, eligibility, submit answers, submit exam. |
| [admin](../internal-admin-service/skill-exams/skill-exams-api-specs.md)  | Internal Hub admin      | Read-only list + detail of every skill exam across consultants.        |

## Pipeline at a glance

```
Consultant                                  System                                  Admin
──────────                                  ──────                                  ─────
                                            (admin pre-creates skills via the
                                              skills CRUD module; consultant
                                              picks one to take an exam against.)

GET  /consultant/skill-exams/eligibility ─► { can_register: true/false, reason, details }
                                            (single source of truth for the "Start" button)

GET  /consultant/skill-exams/current   ───► returns active exam or null
                                            (skill, registered_at, expires_at,
                                              remaining_seconds, consultant_view_status)

POST /consultant/skill-exams { skill_id } ─►  status=GENERATING_QUESTIONS
                                              [GENERATE_SKILL_EXAM_QUESTIONS job]
                                                ServerAI.complete(INTERVIEW) → 20 Qs
                                                status → IN_PROGRESS
                                                expires_at = in_progress_at + 60 min

GET  /consultant/skill-exams/:id
POST /consultant/skill-exams/:id/answers   (×20)
POST /consultant/skill-exams/:id/submit ─► status=SUBMITTED (consultant_view_status=PENDING_REVIEW)
                                              [RUN_SKILL_EXAM_COPYLEAKS]
                                              ├── AI detected → COPYLEAKS_FAILED
                                              │                  cooldown +7d (per-skill)
                                              │                  ai_strike_count++
                                              │                  if strikes ≥ 3:
                                              │                    User.isActive = false
                                              │                    every session revoked
                                              │                  admin notification fired
                                              └── pass → status=RUNNING_AI_EVAL
                                                          [RUN_SKILL_EXAM_AI_EVAL]
                                                          (4-tier proficiency assignment —
                                                            see "Score → outcome" table)
                                                          → PASSED  / FAILED
                                                          + admin notification

                                            (Lazy + 5-min sweep) EXPIRED branch:
                                              if expires_at < now while IN_PROGRESS:
                                                status = EXPIRED
                                                user.exam_expired_count++
                                                if count ≥ 3:
                                                  user.exam_taking_blocked_until = now + 2d
                                                admin notification fired
```

## Score → outcome (after CopyLeaks passes)

| AI overall score | Outcome | `assigned_proficiency` | `status` | `cooldown_until`            |
| ---------------: | ------- | ---------------------- | -------- | --------------------------- |
|           `< 40` | FAIL    | `BEGINNER`             | `FAILED` | `now + 30 days` (per-skill) |
|    `40 ≤ x < 80` | FAIL    | `INTERMEDIATE`         | `FAILED` | `now + 30 days` (per-skill) |
|    `80 ≤ x < 90` | PASS    | `SENIOR`               | `PASSED` | `null`                      |
|         `x ≥ 90` | PASS    | `EXPERT`               | `PASSED` | `null`                      |

After every PASS the server recomputes the consultant's `avgRating` across all `ConsultantSkill` rows and sets `consultant_profiles.has_notification_priority = (avgRating ≥ 90)`. That flag drives priority emails + push notifications when new matching projects are published.

## Consultant-view status (logical surface)

Internal `status` walks through `SUBMITTED → RUNNING_COPYLEAKS → RUNNING_AI_EVAL` — to keep the Lonaos UI simple, every response also includes `consultant_view_status` which collapses those three into `PENDING_REVIEW`:

| Underlying `status`    | `consultant_view_status` |
| ---------------------- | ------------------------ |
| `GENERATING_QUESTIONS` | `GENERATING_QUESTIONS`   |
| `IN_PROGRESS`          | `IN_PROGRESS`            |
| `SUBMITTED`            | `PENDING_REVIEW`         |
| `RUNNING_COPYLEAKS`    | `PENDING_REVIEW`         |
| `RUNNING_AI_EVAL`      | `PENDING_REVIEW`         |
| `EXPIRED`              | `EXPIRED`                |
| `COPYLEAKS_FAILED`     | `COPYLEAKS_FAILED`       |
| `FAILED`               | `FAILED`                 |
| `PASSED`               | `PASSED`                 |

The eligibility endpoint treats every non-terminal state as a blocker (`reason: 'pending_exam'`).

## Cool-down / block matrix

| Mechanism                    | Stored where                                             | Scope                       | Duration       | Trigger                                      |
| ---------------------------- | -------------------------------------------------------- | --------------------------- | -------------- | -------------------------------------------- |
| Per-skill low-score cooldown | `consultant_skill_exams.cooldown_until`                  | Per-skill (this skill only) | 30 days        | BEGINNER or INTERMEDIATE fail (score < 80).  |
| Per-skill CopyLeaks cooldown | `consultant_skill_exams.cooldown_until`                  | Per-skill                   | 7 days         | CopyLeaks gate failed (`maxAiScore > 30`).   |
| Platform-wide expired pause  | `users.exam_taking_blocked_until` + `exam_expired_count` | Platform-wide               | 2 days         | 3rd EXPIRED attempt across all skills.       |
| Lifetime AI-strike ban       | `users.is_active = false` + sessions revoked             | Permanent                   | Until appealed | 3rd CopyLeaks failure (`aiStrikeCount ≥ 3`). |

## Timezone

Every datetime in skill-exam responses (`expires_at`, `started_at`, `submitted_at`, `cooldown_until`, `blocked_until`, etc.) is rendered in the **caller's IANA timezone**, sourced from the `x-timezone` request header (validated against `Intl.supportedValuesOf('timeZone')`). When the header is missing or invalid, fields fall back to UTC (`+00:00`). Stored values are always UTC; the conversion is purely a render step.

Example:

```
x-timezone: Asia/Ho_Chi_Minh

"expires_at": "2026-05-14T17:11:00.000+07:00"
```

## Queue rate-limit

The BullMQ queue `consultant-skill-exam` is configured with `limiter: { max: 5, duration: 1000 }` and per-job `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`. CopyLeaks + AI calls drain at ≤ 5 jobs/sec; transient upstream failures retry with exponential backoff. Job handlers are idempotent — they short-circuit on wrong status, so retries are safe.

## Admin notifications

Every terminal skill-exam transition (PASSED / FAILED / EXPIRED / COPYLEAKS_FAILED) and every CopyLeaks-ban fans out an in-app notification to every active admin. See the [admin notification catalog](../internal-admin-service/notifications/notifications-admin-events-api-specs.md) for the `admin_skill_exam_result` and `admin_consultant_banned` payloads.

## Companion docs

- [Auth — Consultant](../identity-service/auth/consultant-account-gates-api-specs.md) — banned-account login behaviour.
- Notifications — [consultant catalog](../consultant-service/notifications/notifications-consultant-events-api-specs.md) · [admin catalog](../internal-admin-service/notifications/notifications-admin-events-api-specs.md).
