# Projects — Business Context

## Purpose

Owns the top-level container under which tasks live and consultants are recruited. A project is created by a business and progresses through a strict status machine enforced at the database level.

## Tables owned

- `projects` — top-level project metadata, status, required consultant count.
- `project_required_skills` — junction (project, skill, is_mandatory).
- `project_interview_questions` — screening questions shown to applicants.
- `project_status_history` — append-only log of every status transition (auto-written by DB trigger).

## Project entity fields

| Column                 | Type         | Notes                                                                                       |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `title`                | varchar(300) | Required                                                                                    |
| `introduction`         | jsonb        | Optional rich-text editor document (TipTap/ProseMirror JSON tree); `null` when not provided |
| `status`               | varchar(20)  | Enforced by DB trigger                                                                      |
| `required_consultants` | smallint     | Default 1                                                                                   |
| `published_at`         | timestamptz  | Auto-stamped by trigger on → `public`                                                       |
| `started_at`           | timestamptz  | Auto-stamped on → `in_progress`                                                             |
| `completed_at`         | timestamptz  | Auto-stamped on → `done`                                                                    |
| `cancelled_at`         | timestamptz  | Auto-stamped on → `cancelled`                                                               |

---

## Status machine

```
draft → setting_up → configured → public → in_progress → done
                                                     ↗
                              (any non-terminal) → cancelled
```

**Code constants** (in `BusinessProjectService`):

- `SETUP_STATUSES`: `{ DRAFT, SETTING_UP, CONFIGURED }` — project is editable, status auto-derived on save.
- `LOCKED_STATUSES`: `{ PUBLIC, IN_PROGRESS, DONE, CANCELLED }` — project is read-only; status changes only via explicit transitions.

**Status auto-derivation** (`deriveSetupStatus`) — runs on every create/update while in a setup status:

1. `DRAFT` → if title is blank or project just created with no extras.
2. `SETTING_UP` → title set, but tasks or skills are missing.
3. `CONFIGURED` → title + at least one task + at least one required skill are present.

**Important:** The DB trigger (`trg_enforce_project_status`) rejects any UPDATE that doesn't match the allowed transition map. App code never validates transitions itself.

---

## Publish workflow

Two-step: `validatePublish` (read-only check) → `confirmPublish` (write).

### Step 1 — `GET /projects-business/:id/publish-validation`

Returns `PublishValidationResponseDto` (9 fields):

```json
{
  "can_publish": true,
  "reason_code": null,
  "account_balance": 10000.0,
  "project_title": "Build an e-commerce platform",
  "project_amount": 5000.0,
  "commission_rate": 0.25,
  "commission_amount": 1250.0,
  "total_amount": 6250.0,
  "payment_type": "pre-paid"
}
```

`commission_rate` is always `0` for credit businesses.

**Eligibility checks (in order):**

1. Project must be owned by the calling business.
2. Status must be `CONFIGURED` — any other status → `reason_code: "project_not_configured"`.
3. Must have at least one task with a price set.
4. **Payment type determination:**
   - `pre-paid` — if `businessProfile.accountBalance > 0` (business has topped up).
   - `credit` — if balance is 0 (credit-based; invoice sent monthly by the billing module).
5. For `pre-paid` only: balance must be ≥ `taskTotal × (1 + commissionRate)` — if insufficient → `reason_code: "insufficient_balance"`, `can_publish: false`.

### Step 2 — `PATCH /projects-business/:id/publish`

Guards: `@Roles(UserRole.USER)` + `@Platform(ActivePlatform.BUSINESS)`.

**For `pre-paid` businesses (in a DB transaction):**

1. Re-run eligibility check (idempotency guard — balance may have changed).
2. Compute: `commissionRate = businessProfile.commissionRate` (default 0.25).
3. `commissionAmount = taskTotal × commissionRate`.
4. `totalAmount = taskTotal + commissionAmount`.
5. Deduct `totalAmount` from `businessProfile.accountBalance`.
6. Save deducted balance.
7. Create `BusinessTransaction` record:
   - `type: PROJECT_PUBLISHED`
   - `amount: taskTotal` (subtotal before commission)
   - `commissionRate`, `commissionAmount`, `totalAmount`
   - `status: COMPLETED`
8. Set `project.status = PUBLIC` (DB trigger stamps `published_at`).
9. Send **receipt email** (`sendProjectPublishedReceiptEmail`) with full breakdown: subtotal, commission rate %, commission amount, total charged.

**For `credit` businesses (in a DB transaction):**

1. Set `project.status = PUBLIC` (no charge).
2. Send **success email** (`sendProjectPublishedSuccessEmail`).

Email failures are swallowed (logged as error) — the publish itself is never rolled back for email issues.

---

## Recall workflow (`PUBLIC → CONFIGURED`)

`updateStatus` ([business-project.service.ts:343](services/business-project.service.ts)) detects this transition and routes to `handleRecall` instead of letting the DB trigger handle it.

- **Pre-paid businesses:** in a transaction with `setLock("pessimistic_write")` on `business_profiles`:
  1. Locate the original `BusinessTransaction` of type `PROJECT_PUBLISHED, status: COMPLETED` for this project. Missing → `error.project.recall_transaction_not_found` (422).
  2. Add `originalTxn.amount` (subtotal — same value debited at publish; commission is **not** refunded) back to `accountBalance`.
  3. Insert a reversing `BusinessTransaction` of type `REFUND, amount = originalTxn.amount`, linked to the project.
  4. Set `project.status = CONFIGURED`.
- **Credit businesses:** simply transition `project.status = CONFIGURED` with no financial side-effects.
- **Why locked + transactional:** balance update + refund insert + status flip must be atomic, and the lock prevents a concurrent publish from racing with the refund.

All other transitions fall through to the DB trigger (`trg_enforce_project_status`).

---

## Business API (`BusinessProjectService`)

Mounted at `/projects-business`. All routes guarded by `RolesGuard + PlatformGuard` with `@Roles(UserRole.USER) + @Platform(ActivePlatform.BUSINESS)`.

| Method               | Route                                           | Description                                                                  |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `createProject`      | `POST /projects-business`                       | Create project; inline tasks, skills, questions created atomically           |
| `listMyProjects`     | `GET /projects-business/mine`                   | Paginated list with keyword filter; items include aggregates                 |
| `getProject`         | `GET /projects-business/:id`                    | Full project detail with tasks, skills, questions                            |
| `updateProject`      | `PATCH /projects-business/:id`                  | Update fields; replaces skills/tasks/questions; forbidden on LOCKED_STATUSES |
| `deleteProject`      | `DELETE /projects-business/:id`                 | Soft delete (sets `deletedAt`); only allowed in `SETUP_STATUSES`             |
| `updateStatus`       | `PATCH /projects-business/:id/status`           | Manual status override; routes `PUBLIC → CONFIGURED` through `handleRecall`  |
| `validatePublish`    | `GET /projects-business/:id/publish-validation` | Check publish eligibility (read-only)                                        |
| `confirmPublish`     | `PATCH /projects-business/:id/publish`          | Execute publish; charges pre-paid balance                                    |
| `listProjectMembers` | `GET /projects-business/:id/members`            | Paginated list of accepted consultants                                       |

> The overview surface (header, stats, activity feed) lives on a separate controller — see "Overview API" below.

### Create/Update project — inline sub-resources

Tasks, required skills, and interview questions are managed atomically inside the project create/update transaction:

- `ProjectTasksService.createForProject` / `replaceForProject` — full replace on update.
- `ProjectRequiredSkillsService.createForProject` / `replaceForProject` — full replace on update.
- `ProjectInterviewQuestionsService.createForProject` / `replaceForProject` — full replace on update.

### CreateProjectDto fields

```
title (required), introduction?, required_consultants?, skills[], interview_questions[], tasks[]
```

Each task item: `title, description?, price` (price stored in task entity, summed for `projectAmount`).

---

## Overview API (`BusinessProjectOverviewService`)

Read-only surface for the project overview page. Mounted on `BusinessProjectOverviewController` under `/projects-business/:id/overview/*` to avoid colliding with `GET /projects-business/:id` (the rich-edit shape). Same guards as the Business API. Every method calls `assertOwnership(projectId)` first → 404 on miss.

| Route                                        | Service method        | Response DTO                               | Notes                                                                                                                                                                      |
| -------------------------------------------- | --------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET :id/overview`                           | `getHeader`           | `ProjectHeaderResponseDto`                 | Title, status, dates, owner (initials derived from `companyName`), payment block (`is_paid`, `amount`, `currency`, `paid_at` — sourced from latest publish transaction)    |
| `GET :id/overview/members`                   | `getMembers`          | `ProjectMembersOverviewResponseDto`        | Active roster + `pending_approval_count`. `activity_status` bucketed from `last_login_at`: `active` (<8h), `idle` (<48h), else `offline`                                   |
| `GET :id/overview/interview-questions/stats` | `getInterviewStats`   | `ProjectInterviewQuestionStatsResponseDto` | Per-question `answer_count`, `skip_count`, `completion_rate` (3-decimal ratio); plus `avg_completion_rate`                                                                 |
| `GET :id/overview/activity`                  | `getActivity`         | `ProjectActivityFeedResponseDto`           | Paginated via `ActivityFeedDto` (`page`, `page_size` ≤ 50, `types` ∈ `task,application,member`). Events read from `projectActivity` repository — produced by other modules |
| `GET :id/overview/tasks/stats`               | `getTaskStats`        | `ProjectTaskStatsResponseDto`              | `by_status: Record<TaskKanbanStatus, count>` plus `total_open` (excludes `CANCELLED`)                                                                                      |
| `GET :id/overview/applications/stats`        | `getApplicationStats` | `ProjectApplicationStatsResponseDto`       | Counts by `pending`, `accepted` (DB column is `approved_count`, surfaced as `accepted_count`), `rejected`, `withdrawn`                                                     |

---

## Consultant API (`ConsultantProjectService`)

Mounted at `/projects-consultant`. Guards: `@Roles(UserRole.USER) + @Platform(ActivePlatform.CONSULTANT)`.

| Method                 | Route                          | Description                                                                                                                    |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `findMatchingProjects` | `GET /projects-consultant`     | Paginated public projects that require ≥1 skill the calling consultant possesses; consultants with no skills get an empty page |
| `getProjectDetail`     | `GET /projects-consultant/:id` | Project detail (public/in-progress only)                                                                                       |

Consultants see projects only after they are `PUBLIC`. Once `IN_PROGRESS`, still visible (for active work). `DONE`/`CANCELLED` are hidden from discovery.

---

## Payment integration

| Business type                   | Publish charge                                                  | Invoice                           |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------- |
| Pre-paid (`accountBalance > 0`) | Immediate deduction from balance (totalAmount incl. commission) | Receipt email                     |
| Credit (`accountBalance = 0`)   | No charge at publish                                            | Monthly invoice via BillingModule |

Commission is stored per-business on `business_profiles.commission_rate` (numeric 5,4 — default `0.2500` = 25%). The rate is snapshotted into `business_transactions.commission_rate` at publish time so historical records are stable even if the rate changes.

---

## Key invariants

- **Status transitions are DB-enforced.** `trg_enforce_project_status` rejects any UPDATE that doesn't match the allowed transition map. App code MUST NOT validate transitions itself — relying on the trigger keeps behaviour consistent.
- **Lifecycle timestamps auto-stamp.** `published_at`, `started_at`, `completed_at`, `cancelled_at` are set by the DB trigger — no app code needed.
- **History is auto-written.** An AFTER UPDATE trigger inserts a `project_status_history` row from OLD/NEW values.
- **Budget range valid.** CHECK: `budget_max >= budget_min` when both set.
- **`required_consultants >= 1`.** Enforced by DB schema.
- **Sub-resources replace on update.** Tasks, skills, and questions are full-replace (delete + re-insert) on every `updateProject` call — no partial patch.
- **Ownership always checked.** Every business API call calls `resolveBusinessId()` and filters by `businessId`; mismatched projects return 404 (not 403) to avoid leaking IDs.

## Response DTOs

| DTO                                        | Purpose                               | Notable fields                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BusinessProjectResponseDto`               | Full edit shape for create/update/get | `skills[]`, `interview_questions[]`, `tasks[]` inline                                                                                                                                                                                                                                                                                                                                    |
| `BusinessProjectListItemResponseDto`       | Slim list shape                       | `id`, `title`, `status`, lifecycle timestamps (`created_at`, `published_at`, `started_at`, `completed_at`, `cancelled_at`), `total_applications`, `total_tasks`, `total_completed_tasks`, `total_cost` (locked transaction `total_amount` if a completed `PROJECT_PUBLISHED` exists; else `sum(task.price)`), `currency` (USD), `application_avatars[]` (distinct applicant avatar URLs) |
| `ConsultantProjectResponseDto`             | Discovery detail (consultant)         | Includes business address, `payment_type`, `is_partner_platform`                                                                                                                                                                                                                                                                                                                         |
| `ConsultantProjectListItemResponseDto`     | Discovery list (consultant)           | Slim — drops business_id/started_at/cancelled_at; adds `need_interview` boolean                                                                                                                                                                                                                                                                                                          |
| `ProjectMemberResponseDto`                 | `listProjectMembers` row              | Consultant profile + address, status, joined_at                                                                                                                                                                                                                                                                                                                                          |
| `PublishValidationResponseDto`             | Pre-publish eligibility check         | 9 fields incl. `commission_rate`, `commission_amount`, `total_amount`                                                                                                                                                                                                                                                                                                                    |
| `ProjectHeaderResponseDto`                 | Overview header                       | Owner (`avatar_initials` derived), payment block                                                                                                                                                                                                                                                                                                                                         |
| `ProjectMembersOverviewResponseDto`        | Overview roster                       | Per-member `activity_status` (`active`/`idle`/`offline`)                                                                                                                                                                                                                                                                                                                                 |
| `ProjectTaskStatsResponseDto`              | Overview task counts                  | `total_open` excludes `CANCELLED`; `by_status` keyed by `TaskKanbanStatus`                                                                                                                                                                                                                                                                                                               |
| `ProjectApplicationStatsResponseDto`       | Overview app counts                   | 4 buckets (`pending`/`accepted`/`rejected`/`withdrawn`)                                                                                                                                                                                                                                                                                                                                  |
| `ProjectInterviewQuestionStatsResponseDto` | Overview Q&A stats                    | `completion_rate` is a 3-decimal ratio; includes `avg_completion_rate`                                                                                                                                                                                                                                                                                                                   |
| `ProjectActivityFeedResponseDto`           | Overview activity                     | Paginated; `actor` may be `null` for system events                                                                                                                                                                                                                                                                                                                                       |

## External dependencies

- **BusinessProfile** (FK, `ON DELETE RESTRICT`) — commission rate is read from `business_profiles.commission_rate` at publish time.
- **Skills** — `project_required_skills` drives the consultant discovery filter (`findPublicMatchingSkills`).
- **Tasks module** — every task belongs to exactly one project; task prices sum to `projectAmount`. Task counts feed `BusinessProjectListItemResponseDto.total_tasks` and the overview task stats.
- **Applications module** — `project_members` links consultants to in-progress projects; application/member counts feed both list aggregates and overview stats.
- **BillingModule** — credit-based businesses accumulate task settlements into monthly invoices; the project serves as the cost centre.
- **EmailService** — receipt email (pre-paid) or success email (credit) on `confirmPublish`.
- **`projectActivity` repository (UoW)** — the overview activity feed reads `IActivityEventRow` rows produced by the Tasks, Applications, and project_members modules. The projects module **only consumes** these events; it does not write them.

## Critical edge cases

- **Double-publish guard.** `confirmPublish` re-checks eligibility inside the transaction. If two concurrent calls race, the second will fail the balance check (pre-paid) or succeed idempotently (credit — setting PUBLIC twice is a no-op via DB trigger rejection on same-status transitions).
- **Cancelling mid-flight.** Allowed from `DRAFT`, `SETTING_UP`, `CONFIGURED`, `PUBLIC`, `IN_PROGRESS`. DB trigger stamps `cancelled_at`. Active task assignments are NOT automatically cancelled — handled separately by the Tasks module.
- **Editing sub-resources on a published project.** Skills and interview questions can be updated after `PUBLIC` (the project itself is locked, but the junction tables are not). This may change consultant discovery exposure. Tasks cannot be added/removed after `PUBLIC` (locked by the task module's own guards).
- **Balance precision.** All monetary values are stored as `numeric(12,2)` strings. Arithmetic uses `Number()` and `.toFixed(2)` before persistence to avoid floating-point drift.
