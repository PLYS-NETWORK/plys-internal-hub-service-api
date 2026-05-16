# ConsultantOverviewController — API Specs

> **Source:** [src/modules/consultant-projects/controllers/overview.controller.ts](../../../../src/modules/consultant-projects/controllers/overview.controller.ts)
> **Base path:** `/projects/consultant`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                                     |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token.                                                            |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller has no consultant profile.                                                        |
| 404  | `PROJECT_NOT_FOUND`            | Project missing or soft-deleted.                                                         |
| 403  | `PROJECT_FORBIDDEN`            | Caller is not an `ACTIVE` member of the project. Resolved by `resolveProjectMembership`. |
| 422  | (validation)                   | Invalid `:id` UUID.                                                                      |

## Endpoints

### 1. Per-project overview (single aggregated payload)

- **Endpoint:** `GET /projects/consultant/:id/overview`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Behaviour:** Branches on `project.payment_type`:
  - `per_task` — surfaces `earnings.pending_amount` and `earnings.completed_tasks[]`.
  - `per_month` — surfaces `earnings.payment_history[]` and a `next_payment` block (no per-month billing entity yet — `next_payment.date` is computed as the 5th of the next calendar month, mirroring the platform billing cadence; tracked in plan §10.4).
  - In both shapes `progress.days_remaining` is **always `null`** until a `deadline` column is added (plan §10).
- **Response 200:** [`IConsultantOverviewResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-overview.response.interface.ts)

  Common shape:

  ```ts
  {
    project: {
      id, title,
      payment_type: 'per_task' | 'per_month',
      status,                        // ProjectStatus
      started_at: Date | null,
      days_remaining: null
    },
    consultant: {
      id, full_name,
      avatar_url: string | null,
      joined_at: Date                // from project_members.joined_at
    },
    progress: {
      by_status: { todo?, in_progress?, in_review?, done?, ... },  // zero-count statuses omitted
      total_assigned: number,
      completion_rate: number        // 0–1, 2dp; (done / total_assigned), 0 when no tasks assigned
    },
    earnings: { ...branched },
    next_payment?: { ... }            // PER_MONTH only
  }
  ```

  Per-task branch:

  ```ts
  earnings: {
    total_earned: number,             // SUM amount where type = CREDIT_CLEARED
    pending_amount: number,           // SUM amount where type = CREDIT_PENDING
    currency: 'USD',
    completed_tasks: [
      { id, task_id, task_code, task_name, amount }
    ]
  }
  ```

  Per-month branch:

  ```ts
  earnings: {
    total_earned: number,
    currency: 'USD',
    payment_history: [
      { id, transaction_number, amount, status, paid_at, period_start, period_end }
    ]
  },
  next_payment: {
    date: Date,                       // 5th of next month, UTC
    days_until: number,               // ceil days from now to date
    amount: number,                   // last paid amount, else 0
    currency: 'USD',
    last_paid_at: Date | null
  }
  ```

  **Earnings semantics:** `total_earned = SUM(CREDIT_CLEARED)`, `pending_amount = SUM(CREDIT_PENDING)`. `WITHDRAWAL` and `REVERSAL` rows are excluded from both totals (they are ledger movements, not "earned"). All amounts already have platform commission deducted (see [consultant_transactions.amount](../../../../src/database/entities/finance/consultant-transaction.entity.ts)).

  **Currency:** hard-coded `'USD'` until projects gain a per-currency column (plan §10.6).

- **Errors:** cross-cutting only.

---

## FE rendering suggestions

### `project` block

| Field            | Suggested component                                                               |
| ---------------- | --------------------------------------------------------------------------------- |
| `title`          | Page title (H1).                                                                  |
| `payment_type`   | Pill: "Per task" or "Per month" — also drives which earnings panel renders below. |
| `status`         | Status badge.                                                                     |
| `started_at`     | Date metadata row; render `—` when null.                                          |
| `days_remaining` | Always null — render `—` and label "Deadline TBD" until the column ships.         |

### `consultant` block

- Avatar + full name + "Joined `relative time`" line. Cross-link to the consultant profile.

### `progress`

- Donut chart of `by_status` (omit zero-count buckets). Center label: `total_assigned`.
- Linear progress bar bound to `completion_rate` (multiply by 100 for the %).

### Per-task `earnings` (when `payment_type = per_task`)

| Field               | Suggested component                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `total_earned`      | Stat card (currency).                                                                    |
| `pending_amount`    | Secondary stat card next to `total_earned`, label: "Pending payout".                     |
| `completed_tasks[]` | List with `task_code` chip + `task_name` + amount column. Empty state: "No payouts yet". |

### Per-month `earnings` + `next_payment` (when `payment_type = per_month`)

| Field                       | Suggested component                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `next_payment.date`         | Banner: "Next payout in `days_until` days (`date` formatted)".                                      |
| `next_payment.amount`       | Stat card, label: "Expected next payout".                                                           |
| `next_payment.last_paid_at` | Secondary line: "Last paid `relative time`".                                                        |
| `total_earned`              | Stat card (currency).                                                                               |
| `payment_history[]`         | Table with columns: `period_start–period_end`, `transaction_number`, `amount`, `status`, `paid_at`. |
