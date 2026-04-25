# Tasks — Business Context

## Purpose
Owns the atomic unit of work inside a project. A task carries its own price, kanban state, single assignee, comments, dispute, and immutable change history. This module provides runtime task lifecycle management (creation, assignment, status transitions, payment triggers) for `in_progress` projects. Bulk task setup during project configuration is handled by `ProjectTasksService` in the Projects module.

## Tables owned
- `tasks` — title, `description` (jsonb — TipTap/ProseMirror rich-text document, nullable), price, generated platform fee + payout columns, kanban status, assignment, version (optimistic lock).
- `task_disputes` — opened when business rejects work at `pending_approval`.
- `task_history` — append-only audit of every status / assignment / approval change.
- `task_comments` — flat comment thread per task. `comment` (jsonb, was `body text`) is a rich-text editor JSON document. Soft-delete only.
- `task_comment_attachments` — file metadata; bytes live in object storage. `file_id` FK (nullable, ON DELETE SET NULL) keeps the audit chain to the canonical `files` row.
- `task_evidences` — proof-of-work records authored by the assigned consultant. `remarks` is a `jsonb` document (rich-text editor JSON tree). Soft-delete via `is_deleted`. Optimistic lock via `@VersionColumn`.
- `task_evidence_attachments` — denormalised file metadata per evidence; same shape as `task_comment_attachments`.

## Endpoints

### Business — `TasksBusinessController` (`/tasks-business`)
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tasks-business` | `@Roles(USER)` `@Platform(BUSINESS)` | Create a draft task for an `in_progress` project |
| POST | `/tasks-business/:id/assign` | `@Roles(USER)` `@Platform(BUSINESS)` | Assign a consultant to a `to_do` task |
| PATCH | `/tasks-business/:id/business-status` | `@Roles(USER)` `@Platform(BUSINESS)` | Change task status (business-side transitions) |
| POST | `/tasks-business/:id/comments` | `@Roles(USER)` `@Platform(BUSINESS)` | Create a comment on a task |
| GET | `/tasks-business/:id/comments` | `@Roles(USER)` `@Platform(BUSINESS)` | List comments (paginated, ASC by createdAt) |
| PATCH | `/tasks-business/comments/:commentId` | `@Roles(USER)` `@Platform(BUSINESS)` | Edit own comment |
| DELETE | `/tasks-business/comments/:commentId` | `@Roles(USER)` `@Platform(BUSINESS)` | Soft-delete own comment |

### Consultant — `TasksConsultantController` (`/tasks-consultant`)
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tasks-consultant/:id/claim` | `@Roles(USER)` `@Platform(CONSULTANT)` | Self-assign to an unassigned `to_do` task |
| PATCH | `/tasks-consultant/:id/consultant-status` | `@Roles(USER)` `@Platform(CONSULTANT)` | Change task status (consultant-side transitions) |
| POST | `/tasks-consultant/:id/comments` | `@Roles(USER)` `@Platform(CONSULTANT)` | Create a comment on a task |
| GET | `/tasks-consultant/:id/comments` | `@Roles(USER)` `@Platform(CONSULTANT)` | List comments (paginated, ASC by createdAt) |
| PATCH | `/tasks-consultant/comments/:commentId` | `@Roles(USER)` `@Platform(CONSULTANT)` | Edit own comment |
| DELETE | `/tasks-consultant/comments/:commentId` | `@Roles(USER)` `@Platform(CONSULTANT)` | Soft-delete own comment |
| POST | `/tasks-consultant/:id/evidences` | `@Roles(USER)` `@Platform(CONSULTANT)` | Create an evidence (assigned consultant only) |
| PATCH | `/tasks-consultant/evidences/:evidenceId` | `@Roles(USER)` `@Platform(CONSULTANT)` | Edit own evidence (remarks and/or replace attachments) |
| DELETE | `/tasks-consultant/evidences/:evidenceId` | `@Roles(USER)` `@Platform(CONSULTANT)` | Soft-delete own evidence |

### Shared — `TasksController` (`/tasks`)
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/tasks/:id/evidences` | `@Roles(USER)` | List all non-deleted evidences for a task — project owner business OR ACTIVE project member consultant |

## Key invariants
- **Generated columns.** `platform_fee_amount` and `consultant_payout` are STORED generated columns — never write them. Computed from `price` and `platform_fee_rate`.
- **`platform_fee_rate` locked after approval.** §H6 — trigger refuses UPDATE of `platform_fee_rate` when `OLD.kanban_status` is `pending_approval` or `done`.
- **Optimistic locking.** `@VersionColumn` (§H1) — TypeORM auto-increments on every save; concurrent stale UPDATEs throw `OptimisticLockVersionMismatchError`.
- **Race-free claim.** `claimTask()` uses `pessimistic_write_or_fail` lock via `createQueryBuilder().setLock()` to prevent two consultants claiming the same task simultaneously.
- **Single assignee.** `assigned_to` is nullable; only one consultant at a time. Trigger `trg_clear_task_assignment` (§H4) auto-nulls `assigned_to` and `assigned_at` when status reverts to `to_do`.
- **Dispute → status sync.** §H5 — opening a dispute flips `tasks.kanban_status` to `disputed`; resolving flips it back (approved → `done`, rejected → `revision_requested`).
- **History is auto-written.** §H3 — AFTER UPDATE trigger writes `task_history` rows from OLD/NEW values. App code does not need to write them.
- **Display order unique per project** (excluding cancelled). Partial unique index.
- **Project must be `in_progress`.** `createDraftTask()` rejects any project not in `IN_PROGRESS` status.
- **Business cannot revert to DRAFT.** `updateBusinessStatus()` rejects `DRAFT` as a target status.
- **Consultant transition map is fixed.** Only three transitions are allowed: `ASSIGNED → IN_PROGRESS`, `IN_PROGRESS → IN_REVIEW`, `REVISION_REQUESTED → IN_PROGRESS`. All others are rejected.
- **Consultant must be assigned to the task.** `updateConsultantStatus()` verifies `task.assignedTo === consultantProfile.id` before allowing any status change.
- **Assignment requires ACTIVE project membership.** Both `claimTask()` and `assignTask()` verify the consultant has `ProjectMemberStatus.ACTIVE` on the task's project.

## Payment flows

### draft → to_do (Payment Gate)
Business calls `PATCH /tasks-business/:id/business-status { status: to_do }`.

```
Pre-paid business (allowPaymentCredit = false):
  1. Check businessProfile.accountBalance >= task.price
  2. Deduct accountBalance by task.price
  3. Insert BusinessTransaction (type: TASK_ADDED, status: COMPLETED, taskId, projectId)
  4. Set kanbanStatus = TO_DO

Credit business (allowPaymentCredit = true):
  1. Set kanbanStatus = TO_DO (no charge — settled on 5th of month)
```

### any → done (Consultant Payout)
Business calls `PATCH /tasks-business/:id/business-status { status: done }`.

```
All paths:
  1. Set kanbanStatus = DONE, approvedBy = userId, approvedAt = NOW()
  2. Look up assigned consultant profile

Pre-paid business:
  3. Credit consultantProfile.accountBalance += task.consultantPayout
  4. Insert ConsultantTransaction (type: CREDIT_CLEARED, status: COMPLETED, taskId, projectId)

Credit business:
  3. Insert ConsultantTransaction (type: CREDIT_PENDING, status: PENDING, taskId, projectId)
     — settled by BillingSettlementService on 5th of month
```

### Task Claim (Race-Free)
Consultant calls `POST /tasks-consultant/:id/claim`.

```
1. BEGIN TRANSACTION
2. SELECT task FOR UPDATE (pessimistic_write_or_fail)
   WHERE kanban_status = TO_DO AND assigned_to IS NULL
3. If no row → CONFLICT (task already claimed or not available)
4. Verify consultant is ACTIVE project member
5. Set assignedTo, assignedAt, kanbanStatus = ASSIGNED
6. COMMIT
```

## State machines
```
draft → to_do → assigned → in_progress → in_review → pending_approval → done
                                                            │
                                                  ┌─────────┤
                                                  ↓         ↓
                                  revision_requested    disputed → (resolved → done OR revision)
                                                  ↓
                                            in_progress (rework)

(any active state) → cancelled
```

### Consultant-allowed transitions (enforced by CONSULTANT_TRANSITIONS map)
```
ASSIGNED → IN_PROGRESS
IN_PROGRESS → IN_REVIEW
REVISION_REQUESTED → IN_PROGRESS
```

## Comments

### Access control
- **Create:** caller must be project owner (business) OR ACTIVE project member (consultant).
- **Edit:** only the comment author (`comment.authorId === requestContext.userId`).
- **Delete:** only the comment author (soft-delete: `isDeleted = true`).
- **List:** any project owner or ACTIVE member. Paginated, ordered by `createdAt ASC`, excludes soft-deleted.

### Edit tracking
When a comment is updated: `comment` (the JSON document) is replaced, `isEdited = true`, `editedAt = NOW()`.

## Evidences

### Access control
- **Create:** caller must be the consultant currently in `tasks.assigned_to`. Any other consultant — including ACTIVE project members not assigned to that task — gets `EVIDENCE_NOT_ASSIGNEE` (403).
- **List:** project owner (business) OR ACTIVE consultant member (same predicate as comments).
- **Edit / Delete:** only the original author (`evidence.authorId === requestContext.userId`).

### `remarks` is opaque JSON
The column is `jsonb`. Clients send the rich-text editor's document tree (e.g. TipTap/ProseMirror) and the server persists it verbatim — no parsing, no plain-text extraction, no length validation. The DTO uses `@IsObject()` + `@IsNotEmptyObject()`; nested structure is unconstrained.

### Attachments are durable snapshots
On create / replace, the service reads each `file_id` from the `files` table, verifies `ownerUserId === caller`, and snapshots `file_name`, `file_url`, `mime_type`, and `file_size_bytes` into the `task_evidence_attachments` row. The `file_id` FK is `ON DELETE SET NULL` so removing the source `files` row doesn't break the evidence — the snapshot is the source of truth.

### Update semantics
PATCH accepts `remarks?` and `file_ids?` — at least one must be present (`EVIDENCE_EMPTY_UPDATE`, 400). When `remarks` is supplied the row is updated and `is_edited` / `edited_at` are bumped. When `file_ids` is supplied (even as `[]`) the existing attachments are deleted and replaced with rows derived from the new IDs. Concurrent edits are protected by `@VersionColumn`.

## External dependencies
- **Project** (FK `ON DELETE CASCADE`) — deleting a project removes its tasks.
- **ConsultantProfile** (`assigned_to` FK, `ON DELETE SET NULL`).
- **BusinessProfile** — resolved via `RequestContextService` for ownership checks and payment flows.
- **ProjectMembers** — membership verification for assignment and claiming.
- **Notifications** — task submitted, approved, revision requested, dispute opened/resolved → all create notifications for the affected party.
- **Billing** (Domain 8) — task entering billing flow gets `billing_period_id` set; line item written. Credit businesses' `CREDIT_PENDING` transactions are settled by `BillingSettlementService`.
- **Payments** — `BusinessTransaction` and `ConsultantTransaction` rows created during status transitions.

## Critical edge cases
- **Concurrent claims** — handled by `pessimistic_write_or_fail`. Two consultants clicking "Claim" simultaneously: one gets the row, the other gets a CONFLICT error.
- **Insufficient balance on draft→to_do** — pre-paid businesses get `PAYMENT_INSUFFICIENT_BALANCE` (422). Credit businesses bypass the check entirely.
- **Task done without assignee** — `handleTaskDone()` skips consultant payout if `assignedTo` is null. The task still moves to `done`.
- **Reassignment to same consultant** — no-op at status level, but writes a history row.
- **Cancelling a task with billing already attached** — service layer should refuse if `kanban_status = done` and `billing_period_id` is set.
- **Comment on a deleted task** — comments are CASCADE-deleted with the task. Soft-deleted task comments are never re-added.
- **Edit a comment** — must set both `is_edited = TRUE` and `edited_at = NOW()` in the same UPDATE.
