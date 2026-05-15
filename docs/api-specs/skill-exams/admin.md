# Admin — Consultant Skill Exams (read-only)

> **Source:** [src/modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller.ts](../../../src/modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller.ts)
> **Base path:** `/api/v1/admin/skill-exams`
> **Scope (applies to every endpoint):** Bearer auth, `RolesGuard`, `@Roles(UserRole.ADMIN_PLATFORM)`.
> **Field-name convention:** request/response payloads use **snake_case**.
> **Timezone:** every datetime is rendered in the admin's `x-timezone` (default UTC).

Read-only by design — skill exams are fully automated and there is **no admin write / decide / re-score** endpoint.

## Cross-cutting errors

| HTTP | error_code             | When                                              |
| ---- | ---------------------- | ------------------------------------------------- |
| 401  | `GENERIC_UNAUTHORIZED` | Missing / invalid Bearer access token.            |
| 403  | (role)                 | Token's role is not `ADMIN_PLATFORM`.             |
| 404  | `SKILL_EXAM_NOT_FOUND` | Exam id does not exist.                           |
| 422  | (validation)           | DTO failed validation (UUIDs, enum values, etc.). |

---

## Endpoints

### 1. List skill exams (paginated)

- **Endpoint:** `GET /admin/skill-exams`
- **Query params:** `ListSkillExamsDto`

  | Field           | Type      | Required | Notes                                                                                                                                                        |
  | --------------- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `status`        | enum      | no       | `GENERATING_QUESTIONS \| IN_PROGRESS \| SUBMITTED \| RUNNING_COPYLEAKS \| COPYLEAKS_FAILED \| RUNNING_AI_EVAL \| PASSED \| FAILED \| EXPIRED`. Omit for any. |
  | `consultant_id` | uuid      | no       | Filter to a single `ConsultantProfile.id` (NOT `user_id`).                                                                                                   |
  | `skill_id`      | uuid      | no       | Filter to a single skill.                                                                                                                                    |
  | `page`          | int ≥ 1   | no       | Default `1`.                                                                                                                                                 |
  | `take`          | int 1–100 | no       | Default `20`.                                                                                                                                                |

- **Response 200:** `AdminPaginatedSkillExamsResponseDto` — list columns deliberately match the admin spec: consultant full name, skill name, rating (`ai_eval_score`), level (`assigned_proficiency`), status.

  ```json
  {
    "data": [
      {
        "id": "01H8E5...",
        "consultant_user_id": "0f3b9d24-...-aa01",
        "consultant_full_name": "Jane Doe",
        "skill_id": "01H8...",
        "skill_name": "graphic_design",
        "status": "PASSED",
        "assigned_proficiency": "expert",
        "ai_eval_score": "92.50",
        "attempt_number": 1,
        "fail_reason": null,
        "submitted_at": "2026-05-13T09:00:00.000+07:00",
        "concluded_at": "2026-05-13T09:05:00.000+07:00",
        "created_at": "2026-05-13T08:30:00.000+07:00"
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

### 2. Get exam detail

Full exam metadata + the 20 Q&As with per-answer CopyLeaks + AI eval scores + feedback.

- **Endpoint:** `GET /admin/skill-exams/:examId`
- **Path params:** `examId` (UUID v4)
- **Response 200:** `AdminSkillExamDetailResponseDto`

  ```json
  {
    "id": "01H8E5...",
    "consultant_user_id": "0f3b9d24-...-aa01",
    "consultant_full_name": "Jane Doe",
    "consultant_email": "jane@example.com",
    "bio": "Senior brand designer with 7 years of experience...",
    "skill_id": "01H8...",
    "skill_name": "graphic_design",
    "status": "PASSED",
    "assigned_proficiency": "expert",
    "ai_eval_score": "92.50",
    "attempt_number": 1,
    "fail_reason": null,
    "correct_count": 19,
    "copyleaks_aggregate_score": "12.30",
    "cooldown_until": null,
    "started_at": "2026-05-13T08:31:10.000+07:00",
    "expires_at": "2026-05-13T09:31:10.000+07:00",
    "submitted_at": "2026-05-13T09:00:00.000+07:00",
    "concluded_at": "2026-05-13T09:05:00.000+07:00",
    "created_at": "2026-05-13T08:30:00.000+07:00",
    "questions": [
      {
        "id": "01H8E6...",
        "question_order": 1,
        "content": "Describe your approach to building a brand-identity package…",
        "answer_text": "I start by interviewing stakeholders, then…",
        "ai_eval_score": "95.00",
        "copyleaks_ai_score": "10.50",
        "is_correct": true,
        "ai_feedback": "Strong stakeholder-first framing; concrete example used."
      }
    ]
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------------------- | ----------------------------- |
  | 404 | `SKILL_EXAM_NOT_FOUND` | Exam id does not exist. |

---

## Admin notifications

Every terminal skill-exam transition (PASSED / FAILED / EXPIRED / COPYLEAKS_FAILED) and every CopyLeaks 3-strike ban fans out an in-app notification to every active admin:

- `admin_skill_exam_result` — `{ outcome, exam_id, consultant_user_id, consultant_name, skill_id, skill_name, final_score, proficiency_level?, assigned_proficiency?, cooldown_until?, strike_count? }`
- `admin_consultant_banned` — `{ consultant_user_id, consultant_name, ban_reason, banned_at, ai_strike_count }`

Both carry `redirect_url` deep-linking back to `/admin/skill-exams/{exam_id}` and `/admin/users/{consultant_user_id}` respectively.
