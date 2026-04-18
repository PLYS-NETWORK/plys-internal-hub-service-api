# Applications & Screening — Business Context

## Purpose
Owns the consultant→project application flow and the resulting project membership. Includes per-project screening questions, the answers to them, and the authoritative roster of accepted consultants.

## Tables owned
- `screening_questions` + `screening_question_choices` — business-defined intake questions per project.
- `project_applications` — the application itself (cover letter, proposed rate, status).
- `application_answers` + `application_answer_choices` — submitted responses, with question text snapshot.
- `project_members` — accepted consultants currently working on a project.

## Key invariants
- **Re-application allowed.** Partial unique index on `(project_id, consultant_id)` only blocks duplicates among `pending` and `accepted` statuses. Rejected/withdrawn applications can be re-submitted.
- **Screening questions lock at publish.** §H5 + §C6 (race-fix) — `trg_lock_screening_questions_*` refuses UPDATE/DELETE once project status is past `configured`. The trigger uses an advisory lock to avoid a publish/edit interleave.
- **`question_text_snapshot`** preserves the wording shown to the consultant — answers stay coherent even if the question is later modified (only possible while unpublished).
- **`maxConcurrentProjects` enforced.** §C5 — `trg_enforce_consultant_project_limit` runs `SELECT ... FOR UPDATE` on the consultant row before counting active memberships, eliminating the race where two acceptances both pass the check.
- **`project_members.application_id`** is `RESTRICT` on delete — every membership traces back to an application for audit.
- **Unique `(project_id, consultant_id)`** in `project_members` — a consultant cannot be added twice to the same project.

## State machines
```
project_applications:  pending → accepted → (project_members row created)
                              → rejected   ↓ (re-apply allowed)
                              → withdrawn  ↓ (re-apply allowed)

project_members:  active → removed (kicked by business)
                         → left    (consultant exits)
```

## External dependencies
- **Project** — must be in `public` (or `in_progress` while `hiring_mode = TRUE`) to receive applications.
- **ConsultantProfile** — applicant identity; `maxConcurrentProjects` cap enforced here.
- **Tasks** — once a member, the consultant can be assigned tasks under the project.
- **Notifications** — application received (→ business managers), application accepted/rejected (→ consultant).
- **Finance / Billing** — only `project_members` rows count toward the consultant's wallet entries.

## Critical edge cases
- **Concurrent acceptances** of two applications by the same consultant from two projects — protected by §C5 row lock; the slower transaction sees the updated count and gets rejected.
- **Modifying a published project's screening** — `trg_lock_screening_questions_*` raises an exception. Service layer should surface a clear error; the business must clone the project to change questions.
- **Rejected then re-applied** — old answers stay; new application gets new answers. The unique constraint allows the new pending row only because the rejected row is no longer in the active set.
- **Consultant deletion** is `ON DELETE RESTRICT` — applications and memberships pin the consultant in place. Force-delete must clean up these rows first or rely on `is_active = FALSE` on the user.
