# Projects — Business Context

## Purpose
Owns the top-level container under which tasks live and consultants are recruited. A project is created by a business and progresses through a strict status machine enforced at the database level.

## Tables owned
- `projects` — top-level project metadata, status, hiring mode, budget range.
- `project_required_skills` — junction (project, skill, is_mandatory).
- `project_status_history` — append-only log of every status transition.

## Key invariants
- **Status transitions are DB-enforced.** `trg_enforce_project_status` rejects any UPDATE that doesn't match the allowed transition map. App code MUST NOT validate transitions itself — relying on the trigger keeps behaviour consistent.
- **`hiring_mode` is auto-managed.** Set TRUE by trigger when status → `public`; toggleable when `in_progress`; forced FALSE for any other status. Never set this column manually except inside the toggleable window.
- **Lifecycle timestamps auto-stamp.** `published_at`, `started_at`, `completed_at`, `cancelled_at` are set by the same trigger when status changes — no app code needed.
- **History is auto-written** (§H3 fix). An AFTER UPDATE trigger inserts a `project_status_history` row from OLD/NEW values. App code does not need to write this table directly.
- **Budget range valid.** CHECK: `budget_max >= budget_min` when both set.
- **`required_consultants >= 1`.** Schema fix §H7 — when transitioning to `in_progress`, the trigger should also verify enough `project_members` rows exist (added in this domain's migration).

## State machines
```
draft → setting_up → configured → public → in_progress → done
   ↑          ↑           ↑          ↑
   └──────────┘           │          │       (rollbacks)
              └───────────┘          │
                          └──────────┘ (skip public if no hiring needed)

(any non-terminal state) → cancelled
```

`hiring_mode` table:

| Status | hiring_mode |
|---|---|
| `public` | TRUE (auto, locked) |
| `in_progress` | toggleable |
| any other | FALSE (auto, locked) |

## External dependencies
- **BusinessProfile** (FK, `ON DELETE RESTRICT`) — projects cannot be deleted by deleting their business.
- **Skills** (via `project_required_skills`) — used by the Applications module's discovery filter when listing projects to consultants.
- **Tasks** (Domain 4) — every task belongs to exactly one project.
- **Applications** (Domain 6) — applications and `project_members` link to projects.
- **Notifications** — status transitions trigger notifications to project members.

## Critical edge cases
- **Concurrent status updates.** The status-transition trigger reads `OLD.status`; `SELECT FOR UPDATE` is implicit on UPDATE in PostgreSQL, so two concurrent `setting_up → configured` calls serialize correctly.
- **Cancelling mid-flight.** Allowed from `draft`, `setting_up`, `configured`, `public`, `in_progress`. Stamps `cancelled_at`. Tasks under the project should be reviewed by the service layer (none of the DB triggers cascade).
- **Editing required skills after publish.** Allowed — but consultant filters may now show the project to a different audience. Service layer should warn the business.
