# Tasks — Business Context

## Purpose
Owns the atomic unit of work inside a project. A task carries its own price, kanban state, single assignee, comments, dispute, and immutable change history.

## Tables owned
- `tasks` — title, description, price, generated platform fee + payout columns, kanban status, assignment, version (optimistic lock).
- `task_disputes` — opened when business rejects work at `pending_approval`.
- `task_history` — append-only audit of every status / assignment / approval change.
- `task_comments` — flat comment thread per task. Soft-delete only.
- `task_comment_attachments` — file metadata; bytes live in object storage.

## Key invariants
- **Generated columns.** `platform_fee_amount` and `consultant_payout` are STORED generated columns — never write them. Computed from `price` and `platform_fee_rate`.
- **`platform_fee_rate` locked after approval.** §H6 — trigger refuses UPDATE of `platform_fee_rate` when `OLD.kanban_status` is `pending_approval` or `done`.
- **Optimistic locking.** `@VersionColumn` (§H1) — TypeORM auto-increments on every save; concurrent stale UPDATEs throw `OptimisticLockVersionMismatchError`.
- **Race-free claim.** Service layer must use `SELECT ... FOR UPDATE SKIP LOCKED` when claiming a task; do not rely on application-side checks.
- **Single assignee.** `assigned_to` is nullable; only one consultant at a time. Trigger `trg_clear_task_assignment` (§H4) auto-nulls `assigned_to` and `assigned_at` when status reverts to `to_do`.
- **Dispute → status sync.** §H5 — opening a dispute flips `tasks.kanban_status` to `disputed`; resolving flips it back (approved → `done`, rejected → `revision_requested`).
- **History is auto-written.** §H3 — AFTER UPDATE trigger writes `task_history` rows from OLD/NEW values. App code does not need to write them.
- **Display order unique per project** (excluding cancelled). Partial unique index.

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

## External dependencies
- **Project** (FK `ON DELETE CASCADE`) — deleting a project removes its tasks.
- **ConsultantProfile** (`assigned_to` FK, `ON DELETE SET NULL`).
- **Notifications** — task submitted, approved, revision requested, dispute opened/resolved → all create notifications for the affected party.
- **Billing** (Domain 8) — task entering billing flow gets `billing_period_id` set; line item written.
- **Wallets** (Domain 8) — task approval triggers `credit_pending` wallet transaction.

## Critical edge cases
- **Concurrent claims** — handled by SKIP LOCKED. Two consultants clicking "Claim" simultaneously: one gets the row, the other gets nothing and sees a clean "already taken" message.
- **Reassignment to same consultant** — no-op at status level, but writes a history row.
- **Cancelling a task with billing already attached** — service layer should refuse if `kanban_status = done` and `billing_period_id` is set.
- **Comment on a deleted task** — comments are CASCADE-deleted with the task. Soft-deleted task comments are never re-added.
- **Edit a comment** — must set both `is_edited = TRUE` and `edited_at = NOW()` in the same UPDATE.
