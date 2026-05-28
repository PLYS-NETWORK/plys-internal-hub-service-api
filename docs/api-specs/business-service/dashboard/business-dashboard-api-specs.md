# BusinessDashboardController — API Specs

> **Source:** [apps/business-service/src/modules/statistics/business/dashboard/business-dashboard.controller.ts](../../../../apps/business-service/src/modules/statistics/business/dashboard/business-dashboard.controller.ts)
> **Base path:** `/api/v1/business/dashboard`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@UseGuards(RolesGuard, PlatformGuard)` + `@Roles(UserRole.USER)` + `@Platform(ActivePlatform.BUSINESS)`. Non-business callers receive `403`. The global `JwtAuthGuard` enforces auth before the role/platform check runs.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).
> **Replaces:** the previous `/statistics-business/*` surface — that controller and its nine endpoints have been removed. SPA clients must migrate to the URLs below.
> **Caching:** `summary` (60 s) and `action-items` (30 s) are cached in Redis per-business under keys `business:dashboard:summary:{businessId}:v1` and `business:dashboard:action_items:{businessId}:v1`. Cache writes are best-effort — a Redis outage degrades to direct-DB reads, not a 5xx. The other three endpoints skip cache.

## Cross-cutting errors

| HTTP | error_code                   | When                                                                                                                                        |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token (global `JwtAuthGuard`).                                                                                       |
| 403  | (forbidden, no error_code)   | Caller is authenticated but not `UserRole.USER` / `ActivePlatform.BUSINESS`.                                                                |
| 403  | `BUSINESS_PROFILE_NOT_FOUND` | Caller is on the BUSINESS platform but has no business profile yet — surfaced by the service before any aggregate query runs.               |
| 422  | (validation)                 | DTO shape failures from `class-validator` — invalid ISO date in `from`/`to`, `granularity` / `sort` outside the enum, `limit` over the cap. |

---

## Endpoints

### 1. Batched KPI summary

- **Endpoint:** `GET /business/dashboard/summary`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** none.

- **Behaviour:**
  1. Resolves the caller's `BusinessProfile` (404→403 mapping). Tries
     `business:dashboard:summary:{businessId}:v1` in Redis. On hit, returns the cached payload.
  2. On miss, fetches the project-id set + active project subset, then fan-outs the
     17 sub-aggregates in parallel (`Promise.all`) — money / portfolio / throughput /
     team / action-counts.
  3. Derives the `at_risk_count` (active projects intersected with projects that
     have ≥1 overdue task), the `on_time_delivery_pct` (`onTime/total` rounded
     to one decimal), and `avg_cycle_days` (one decimal, `null` when no qualifying
     rows).
  4. Stamps `generated_at` with the live request time and writes back to Redis
     with a 60 s TTL.

- **Response 200:** [`IBusinessDashboardSummaryResponse`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-dashboard-summary.response.interface.ts)

  | Field           | Type           | Nullable | Notes                                                                                                     |
  | --------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------- |
  | `money`         | `Money`        | no       | Wallet + spend + outstanding. See nested table.                                                           |
  | `portfolio`     | `Portfolio`    | no       | Project lifecycle counts plus at-risk count. See nested table.                                            |
  | `throughput`    | `Throughput`   | no       | MTD task throughput, review/overdue counts, cycle & on-time metrics. See nested table.                    |
  | `team`          | `Team`         | no       | Active & newly-joined consultant counts. See nested table.                                                |
  | `action_counts` | `ActionCounts` | no       | Per-category counts mirrored by the `/action-items` endpoint. See nested table.                           |
  | `generated_at`  | `ISO 8601`     | no       | Snapshot time. When the response came from cache, this is the **cache write** time, not the request time. |

  **`money`** ([`IBusinessDashboardMoney`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-dashboard-summary.response.interface.ts)):

  | Field                         | Type     | Notes                                                                                                                                                                                  |
  | ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `currency`                    | `string` | ISO 4217. Currently always `USD`.                                                                                                                                                      |
  | `wallet_balance`              | `string` | Decimal. `business_profiles.account_balance` as-is.                                                                                                                                    |
  | `mtd_spend`                   | `string` | Decimal. Sum of `business_transactions.total_amount` where `status = COMPLETED AND type IN (top_up, monthly_billing, project_published, task_added)` between MTD-start and now.        |
  | `projected_monthly_bill`      | `string` | Decimal. Sum of `total_amount` for `TASK_ADDED` rows linked to the business's currently OPEN billing period. Estimates the next monthly invoice if no further tasks land before close. |
  | `outstanding_invoices_amount` | `string` | Decimal. `SUM(invoices.amount) WHERE business_id = ? AND status IN (pending, overdue)`.                                                                                                |
  | `outstanding_invoices_count`  | `number` | Count for the same filter.                                                                                                                                                             |
  | `unpublished_pipeline_value`  | `string` | Decimal. `SUM(task.price)` for tasks belonging to projects in `draft` / `configured` status (excluding CANCELLED tasks) — money sitting in unpublished projects.                       |

  **`portfolio`** ([`IBusinessDashboardPortfolio`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-dashboard-summary.response.interface.ts)):

  | Field                | Type     | Notes                                                                  |
  | -------------------- | -------- | ---------------------------------------------------------------------- |
  | `total_projects`     | `number` | Non-deleted projects owned by the caller (sum of every status bucket). |
  | `active_projects`    | `number` | `PUBLISHED + IN_PROGRESS`.                                             |
  | `completed_projects` | `number` | `DONE`.                                                                |
  | `at_risk_count`      | `number` | Active projects that have ≥1 overdue task.                             |

  **`throughput`** ([`IBusinessDashboardThroughput`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-dashboard-summary.response.interface.ts)):

  | Field                  | Type     | Nullable | Notes                                                                                                           |
  | ---------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------- |
  | `tasks_completed_mtd`  | `number` | no       | DONE tasks whose `completed_at` falls in the current month-to-date window.                                      |
  | `tasks_in_review`      | `number` | no       | Tasks currently in `IN_REVIEW`. Mirrored in `action_counts.tasks_awaiting_review`.                              |
  | `tasks_overdue`        | `number` | no       | Tasks with `due_date < NOW()` and status `NOT IN (done, cancelled)`. Mirrored in `action_counts.overdue_tasks`. |
  | `avg_cycle_days`       | `string` | yes      | Mean (`completed_at - started_at`) in days over DONE rows in MTD, one decimal. `null` when no qualifying rows.  |
  | `on_time_delivery_pct` | `string` | yes      | `(on_time / total_done) * 100` over MTD DONE rows that have a `due_date`, one decimal. `null` when none.        |

  **`team`** ([`IBusinessDashboardTeam`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-dashboard-summary.response.interface.ts)):

  | Field                 | Type     | Notes                                                                                 |
  | --------------------- | -------- | ------------------------------------------------------------------------------------- |
  | `active_consultants`  | `number` | Distinct consultants with at least one ACTIVE membership across the owner's projects. |
  | `new_consultants_mtd` | `number` | Distinct consultants whose first ACTIVE `joined_at` for an owner-project is in MTD.   |

  **`action_counts`** ([`IBusinessDashboardActionCounts`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-dashboard-summary.response.interface.ts)):

  | Field                   | Type     | Notes                                                          |
  | ----------------------- | -------- | -------------------------------------------------------------- |
  | `tasks_awaiting_review` | `number` | Tasks currently in `IN_REVIEW` across the owner's projects.    |
  | `overdue_tasks`         | `number` | Overdue tasks (same definition as `throughput.tasks_overdue`). |
  | `open_disputes`         | `number` | `task_disputes.status = OPEN` across the owner's projects.     |
  | `overdue_invoices`      | `number` | `invoices.status = OVERDUE` for the owner.                     |
  | `pending_topups`        | `number` | `business_transactions.type = TOP_UP AND status = PENDING`.    |

- **Errors:** cross-cutting only.

---

### 2. Action items queue

- **Endpoint:** `GET /business/dashboard/action-items`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** none.

- **Behaviour:** Caches per-business for 30 s. On a miss, fetches the project-id
  set + ten parallel queries (one per category, plus a count). Each category is
  capped at **5 items**; the matching `total` reflects the unfiltered count so
  the SPA can render "+N more" badges.

- **Response 200:** [`IBusinessActionItemsResponse`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-action-items.response.interface.ts)

  Each top-level field has the shape `{ total: number, items: Item[] }`. The
  item shape is per-category:

  **`tasks_awaiting_review.items[]`** — tasks currently in `IN_REVIEW`, oldest first:

  | Field           | Type       | Notes                                                 |
  | --------------- | ---------- | ----------------------------------------------------- |
  | `task_id`       | `string`   | UUID.                                                 |
  | `task_code`     | `string`   | Human-facing code (e.g. `WEB-23`).                    |
  | `title`         | `string`   | Task title.                                           |
  | `project_id`    | `string`   | Owning project UUID.                                  |
  | `project_title` | `string`   | Owning project title.                                 |
  | `submitted_at`  | `ISO 8601` | `task.updated_at` (when the row entered `IN_REVIEW`). |

  **`overdue_tasks.items[]`** — tasks with `due_date < NOW()` not done/cancelled, soonest-due first. Same shape as `tasks_awaiting_review.items` plus:

  | Field          | Type       | Notes                                                        |
  | -------------- | ---------- | ------------------------------------------------------------ |
  | `due_date`     | `ISO 8601` | Original due date.                                           |
  | `days_overdue` | `number`   | Integer days past `due_date` (server-computed via Postgres). |

  **`open_disputes.items[]`** — `task_disputes.status = OPEN`, oldest first:

  | Field            | Type       | Notes                                                     |
  | ---------------- | ---------- | --------------------------------------------------------- |
  | `dispute_id`     | `string`   | UUID.                                                     |
  | `task_id`        | `string`   | UUID of the disputed task.                                |
  | `task_code`      | `string`   | Code of the disputed task.                                |
  | `reason_snippet` | `string`   | First 120 characters of `dispute.reason`, server-trimmed. |
  | `opened_at`      | `ISO 8601` | `dispute.opened_at`.                                      |

  **`overdue_invoices.items[]`** — `invoices.status = OVERDUE`, soonest-due first:

  | Field          | Type       | Notes                         |
  | -------------- | ---------- | ----------------------------- |
  | `invoice_id`   | `string`   | UUID.                         |
  | `amount`       | `string`   | Decimal.                      |
  | `due_date`     | `ISO 8601` | Original due date.            |
  | `days_overdue` | `number`   | Integer days past `due_date`. |

  **`pending_topups.items[]`** — `business_transactions.type = TOP_UP AND status = PENDING`, most-recent first:

  | Field                | Type       | Notes                                                                                                                                                                    |
  | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `transaction_id`     | `string`   | UUID.                                                                                                                                                                    |
  | `transaction_number` | `string`   | Human-facing number (e.g. `PLSTOP202605120001`).                                                                                                                         |
  | `total_amount`       | `string`   | Decimal.                                                                                                                                                                 |
  | `created_at`         | `ISO 8601` | When the pending row was opened.                                                                                                                                         |
  | `redirect_url`       | `string`   | Always `null` here. The SPA must call `POST /payments/business/top-up/:id/continue` to get a fresh checkout URL — `redirect_url` was deliberately not stored on the row. |

  Each top-level category also carries `generated_at` once on the root response.

- **Errors:** cross-cutting only.

---

### 3. Spend trend

- **Endpoint:** `GET /business/dashboard/spend-trend`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`BusinessSpendTrendDto`](../../../../apps/business-service/src/modules/statistics/dto/requests/business-spend-trend.dto.ts)

  | Field         | Type            | Required | Constraints                              | Notes                                                                                              |
  | ------------- | --------------- | -------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
  | `from`        | `ISO 8601`      | no       | ISO 8601 string                          | Inclusive lower bound on `created_at`. Defaults to **6 calendar months before `to`** when omitted. |
  | `to`          | `ISO 8601`      | no       | ISO 8601 string                          | Inclusive upper bound on `created_at`. Defaults to the current server time when omitted.           |
  | `granularity` | `month \| week` | no       | one of `month`, `week` (default `month`) | Bucket size. `month` → `YYYY-MM`; `week` → ISO `IYYY-IW`.                                          |

- **Behaviour:** Single grouped query on the outflow set (`TOP_UP +
MONTHLY_BILLING + PROJECT_PUBLISHED + TASK_ADDED`, all `COMPLETED`). Service
  computes the running cumulative as it walks the ordered buckets so the SPA
  can render either bar (`spend`) or area (`cumulative`) charts off one payload.

- **Response 200:** [`IBusinessSpendTrendResponse`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-spend-trend.response.interface.ts)

  | Field         | Type            | Notes                                          |
  | ------------- | --------------- | ---------------------------------------------- |
  | `currency`    | `string`        | ISO 4217. Currently `USD`.                     |
  | `granularity` | `month \| week` | Echoed from the request.                       |
  | `points`      | `SpendPoint[]`  | Ascending by `period_label`. See nested table. |

  **`points[]`**:

  | Field          | Type     | Notes                                                               |
  | -------------- | -------- | ------------------------------------------------------------------- |
  | `period_label` | `string` | `YYYY-MM` (monthly) or `IYYY-IW` (weekly).                          |
  | `spend`        | `string` | Decimal sum of completed outflow `total_amount` inside this bucket. |
  | `cumulative`   | `string` | Running sum from the first bucket to this one inclusive.            |

- **Errors:** cross-cutting only.

---

### 4. Project health

- **Endpoint:** `GET /business/dashboard/project-health`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`BusinessProjectHealthDto`](../../../../apps/business-service/src/modules/statistics/dto/requests/business-project-health.dto.ts)

  | Field    | Type            | Required | Constraints                     | Notes                                                                                |
  | -------- | --------------- | -------- | ------------------------------- | ------------------------------------------------------------------------------------ |
  | `status` | `ProjectStatus` | no       | valid enum value                | Optional single-status filter. Defaults to the active set (PUBLISHED + IN_PROGRESS). |
  | `limit`  | `number`        | no       | min `1`, max `50`, default `20` | Max rows in the response.                                                            |

- **Behaviour:**
  1. Pulls the project list (limit-bounded).
  2. Single grouped query against `tasks` returns per-project total / completed
     / in_review / overdue counts + `last_activity_at` + `oldest_in_review_at`.
  3. Single grouped query against `business_transactions` returns MTD spend per project.
  4. Service computes `completion_pct` and the `is_at_risk` flag
     (`overdue_tasks > 0` OR `(in_review_tasks > 0 AND oldest_in_review > 7 days ago)`).
  5. Rows sort at-risk first, then by `last_activity_at` DESC.

- **Response 200:** [`IBusinessProjectHealthResponse`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-project-health.response.interface.ts)

  Top-level: `projects: ProjectHealth[]`, `generated_at: ISO 8601`.

  **`projects[]`**:

  | Field              | Type                 | Nullable | Notes                                                                |
  | ------------------ | -------------------- | -------- | -------------------------------------------------------------------- |
  | `project_id`       | `string`             | no       | UUID.                                                                |
  | `code`             | `string`             | no       | Project code (e.g. `WEB`).                                           |
  | `title`            | `string`             | no       | Project title.                                                       |
  | `status`           | `ProjectStatus`      | no       | Current lifecycle status.                                            |
  | `payment_type`     | `ProjectPaymentType` | no       | `per_task` or `per_month`.                                           |
  | `total_tasks`      | `number`             | no       | All non-deleted tasks.                                               |
  | `completed_tasks`  | `number`             | no       | `kanban_status = DONE`.                                              |
  | `in_review_tasks`  | `number`             | no       | `kanban_status = IN_REVIEW`.                                         |
  | `overdue_tasks`    | `number`             | no       | `due_date < NOW()` and status `NOT IN (done, cancelled)`.            |
  | `completion_pct`   | `string`             | yes      | `(completed / total) * 100` one decimal. `null` when `total = 0`.    |
  | `mtd_spend`        | `string`             | no       | Decimal sum of completed outflow on this project this month-to-date. |
  | `last_activity_at` | `ISO 8601`           | yes      | Latest `task.updated_at`; `null` when no tasks.                      |
  | `is_at_risk`       | `boolean`            | no       | See behaviour rule above.                                            |

- **Errors:** cross-cutting only.

---

### 5. Team performance

- **Endpoint:** `GET /business/dashboard/team-performance`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`BusinessTeamPerformanceDto`](../../../../apps/business-service/src/modules/statistics/dto/requests/business-team-performance.dto.ts)

  | Field   | Type                                                        | Required | Constraints                         | Notes                                                           |
  | ------- | ----------------------------------------------------------- | -------- | ----------------------------------- | --------------------------------------------------------------- |
  | `from`  | `ISO 8601`                                                  | no       | ISO 8601 string                     | Inclusive lower bound on `completed_at`. Defaults to MTD start. |
  | `to`    | `ISO 8601`                                                  | no       | ISO 8601 string                     | Inclusive upper bound on `completed_at`. Defaults to now.       |
  | `limit` | `number`                                                    | no       | min `1`, max `50`, default `20`     | Max rows.                                                       |
  | `sort`  | `completed_tasks_desc \| on_time_pct_desc \| avg_cycle_asc` | no       | one of those values (default first) | Metric to sort by. `null` metric values land last regardless.   |

- **Behaviour:**
  1. Pulls the active-consultant roster across the caller's projects (with
     consultant profile join to surface `full_name` + `avatar_url`).
  2. Single grouped query against `tasks` keyed by `assigned_to` returns
     completed / in-progress / avg-cycle / on-time aggregates over the window.
  3. Service merges, computes derived percentages, and re-sorts by the
     caller-supplied `sort` mode.

- **Response 200:** [`IBusinessTeamPerformanceResponse`](../../../../apps/business-service/src/modules/statistics/dto/responses/interfaces/business-team-performance.response.interface.ts)

  Top-level: `consultants: TeamPerformance[]`, `generated_at: ISO 8601`.

  **`consultants[]`**:

  | Field                   | Type     | Nullable | Notes                                                                                                |
  | ----------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------- |
  | `consultant_id`         | `string` | no       | UUID.                                                                                                |
  | `full_name`             | `string` | no       | `consultant_profiles.full_name`.                                                                     |
  | `avatar_url`            | `string` | yes      | `consultant_profiles.avatar_url`.                                                                    |
  | `active_projects_count` | `number` | no       | Distinct ACTIVE memberships across the caller's projects.                                            |
  | `completed_tasks`       | `number` | no       | DONE tasks whose `completed_at` is in the window.                                                    |
  | `in_progress_tasks`     | `number` | no       | Tasks currently in `IN_PROGRESS` (regardless of window).                                             |
  | `avg_cycle_days`        | `string` | yes      | Mean (`completed_at - started_at`) days over DONE in window, one decimal. `null` when none.          |
  | `on_time_pct`           | `string` | yes      | `(on_time / total_done) * 100` over DONE rows that have a `due_date`, one decimal. `null` when none. |

- **Errors:** cross-cutting only.
