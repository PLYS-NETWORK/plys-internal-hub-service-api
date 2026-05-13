# Consultant Application — API Specs

This directory covers the end-to-end consultant vetting flow under the **two-stage gate** model:

1. **Onboarding** — one-time, human-judged. Basic profile + 10 interview answers (5 COMMUNICATION + 5 SYSTEM_KNOWLEDGE). Admin reads the answers and approves or rejects. Approval unlocks the platform.
2. **Skill exams** — per-skill, fully automated. AI generates 20 questions for the chosen skill, Copyleaks gates AI-generated content, AI scores the answers, and a consultant's `proficiency_level` + `rating` are assigned on pass.

> ℹ️ The legacy single-stage application (30 mixed questions → admin manual scoring) has been retired. All `/consultant/application/*` and `/admin/consultant-applications/*` endpoints are removed; the corresponding tables were dropped by [`20260512000001-RefactorConsultantOnboardingAndSkillExams.ts`](../../../src/database/migrations/20260512000001-RefactorConsultantOnboardingAndSkillExams.ts).

## Files

| File                                                           | Audience              | Covers                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [consultant.md](./consultant.md)                               | Consultant (Lona app) | Onboarding profile + 10-question interview; per-skill exam (start, answer, submit, list, detail)                                                                                                                                                                                                                                                                       |
| [admin.md](./admin.md)                                         | Internal Hub admin    | Admin onboarding review (list, detail, decide). Skill-exam pipeline is fully automated — no admin endpoints.                                                                                                                                                                                                                                                           |
| [admin-interview-questions.md](./admin-interview-questions.md) | Internal Hub admin    | CRUD spec for the COMMUNICATION + SYSTEM_KNOWLEDGE onboarding seed bank. ⚠️ The controller this spec describes was removed alongside the legacy `consultant-application` module — kept here as a spec for the future re-implementation when the question-bank admin UI is needed. The seed table itself (`interview_questions`) is still populated by the seed runner. |

## Pipeline at a glance

```
Consultant                                  System                                  Admin
──────────                                  ──────                                  ─────
POST /consultant/onboarding/profile  ───►   creates onboarding (status=IN_INTERVIEW)
                                            assigns 5 COMMUNICATION + 5 SYSTEM_KNOWLEDGE
                                            (synchronous, from seed bank)

GET  /consultant/onboarding/interview
POST /consultant/onboarding/interview/answers (×10, idempotent)
POST /consultant/onboarding/interview/submit ─►  status → INTERVIEW_SUBMITTED
                                                 emails consultant + admins (TO=first, CC=rest)
                                                                          │
                                                                          ▼ (admin reads answers)
                                            POST /admin/onboardings/:id/decide
                                              ├── APPROVED → ConsultantProfile.isVerified=true
                                              │                 in-app + email notification (consultant)
                                              │                 consultant can start skill exams
                                              └── REJECTED → blocked_until = now + 3 months
                                                            rejection email with rejection_note

(after APPROVED)
POST /consultant/skill-exams { skill_id } ─► status=GENERATING_QUESTIONS
                                              [GENERATE_SKILL_EXAM_QUESTIONS job]
                                                ServerAiService.complete(INTERVIEW) → 20 Qs
                                                status → IN_PROGRESS

GET  /consultant/skill-exams/:examId
POST /consultant/skill-exams/:examId/answers (×20)
POST /consultant/skill-exams/:examId/submit ─► status=SUBMITTED
                                                in-app notification: skill_exam_submitted
                                                [RUN_SKILL_EXAM_COPYLEAKS]
                                                ├── AI detected → COPYLEAKS_FAILED
                                                │                  cooldown +7d
                                                │                  ai_strike_count++
                                                │                  if strikes >= 3 → User.isActive=false
                                                │                                    consultant_account_banned event
                                                │                  consultant_skill_exam_failed event
                                                └── pass → status=RUNNING_AI_EVAL
                                                          [RUN_SKILL_EXAM_AI_EVAL]
                                                          ├── score < 80  → FAILED + cooldown +7d
                                                          │                consultant_skill_exam_failed event
                                                          └── score >= 80 → PASSED
                                                                            80–89 → ADVANCED
                                                                            >= 90 → EXPERT + hasNotificationPriority=true
                                                                            upsert ConsultantSkill (proficiency + rating)
                                                                            insert ConsultantSkillScore (audit)
                                                                            recompute ConsultantProfile.avgRating
                                                                            consultant_skill_exam_passed event
```

## Pass / fail / benefit thresholds (skill exam)

| Final % score       | Outcome                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `< 80%`             | `FAILED` — `fail_reason = LOW_SCORE`, `cooldown_until = now + 7 days`                                                                                |
| `80% ≤ score < 90%` | `PASSED` — `assigned_proficiency = "advanced"`                                                                                                       |
| `≥ 90%`             | `PASSED` — `assigned_proficiency = "expert"` + `ConsultantProfile.hasNotificationPriority = true` (priority tier on new-project notification emails) |

## AI-content strike policy

| Strike # | Outcome                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | Exam `COPYLEAKS_FAILED`, `cooldown_until = now + 7 days`, `users.ai_strike_count = 1`. Other skills unaffected.                                                                |
| 2        | Same as #1 with `users.ai_strike_count = 2`.                                                                                                                                   |
| 3        | Same + `User.isActive = false`, `User.bannedAt = now`, `User.banReason = AI_CONTENT_ABUSE`. Account locked platform-wide; all future calls return `403 AUTH_ACCOUNT_INACTIVE`. |

The strike counter is **lifetime** — it never resets.

## Block enforcement (onboarding REJECT)

A rejected consultant is blocked for **3 months** from re-onboarding. The block is enforced at two points:

1. **Registration** — `POST /auth/register` for `active_platform=consultant` returns `403 CONSULTANT_ONBOARDING_BLOCKED` (with `details.blocked_until`) if a block is active.
2. **Profile submission** — `POST /consultant/onboarding/profile` returns the same error code.

## Companion docs

- [Notifications — Consultant Event Catalog](../notifications/notifications-consultant-events.md) — full schema + sample payloads for the 5 consultant-side notification types (onboarding approved, skill exam submitted, passed, failed, account banned).
- [Notifications — Realtime Guide](../notifications/notifications-realtime-guide.md) — Socket.IO subscription setup.
- [Notifications — REST API](../notifications/notifications-api-specs.md) — fetch / mark-read endpoints.
