# ConsultantDashboardController — API Specs

> **Source:** [apps/consultant-service/src/modules/statistics/consultant/dashboard/consultant-dashboard.controller.ts](../../../../apps/consultant-service/src/modules/statistics/consultant/dashboard/consultant-dashboard.controller.ts)
> **Base path:** `/api/v1/consultant/dashboard`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@UseGuards(RolesGuard, PlatformGuard)` + `@Roles(UserRole.USER)` + `@Platform(ActivePlatform.CONSULTANT)`. Non-consultant callers receive `403`. The global `JwtAuthGuard` enforces auth before the role/platform check runs.
> **Throttle (class-level):** `THROTTLE_INTERACTIVE` (30 req / 60 s) — polled surfaces share the same tier.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).
> **Caching:** `summary` (60 s) and `action-items` (30 s) are cached in Redis per-consultant under keys `consultant:dashboard:summary:{consultantId}:v1` and `consultant:dashboard:action_items:{consultantId}:v1`. Cache writes are best-effort — a Redis outage degrades to direct-DB reads, not a 5xx. The other three endpoints skip cache.
> **Money fields:** every decimal column is returned as a fixed-point **`string`** (`"0.00"` when empty). Never coerce to JS `number` on the client.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                                                                                                               |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token (global `JwtAuthGuard`).                                                                                                              |
| 403  | (forbidden, no error_code)     | Caller is authenticated but not `UserRole.USER` / `ActivePlatform.CONSULTANT`.                                                                                     |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller is on the CONSULTANT platform but has no consultant profile yet — surfaced by the service before any aggregate query runs.                                  |
| 422  | (validation)                   | DTO shape failures from `class-validator` — invalid ISO date in `from`/`to`, `granularity` / `sort` outside the enum, `limit` over the cap, unknown `status` enum. |

---

## Endpoints

### 1. Batched KPI summary

- **Endpoint:** `GET /consultant/dashboard/summary`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** none.

- **Behaviour:**
  1. Resolves the caller's `ConsultantProfile` (404→403 mapping). Tries
     `consultant:dashboard:summary:{consultantId}:v1` in Redis. On hit, returns the cached payload.
  2. On miss, fetches the active-membership project-id set, then fan-outs the
     16 sub-aggregates in parallel (`Promise.all`) — money / portfolio / performance /
     skills / exams / onboarding / action-counts.
  3. Derives `on_time_pct` (`onTime/total` rounded to one decimal), `avg_cycle_days`
     (one decimal, `null` when no qualifying rows), and `is_approved`
     (`onboarding.decision === APPROVED`). Counts `pending_approval_tasks` as
     `IN_REVIEW + PENDING_APPROVAL` since both are business-side queue states.
  4. Stamps `generated_at` with the live request time and writes back to Redis
     with a 60 s TTL.

- **Response 200:** [`IConsultantDashboardSummaryResponse`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)

  | Field           | Type           | Nullable | Notes                                                                                                     |
  | --------------- | -------------- | -------- | --------------------------------------------------------------------------------------------------------- |
  | `money`         | `Money`        | no       | Wallet + earnings figures. See nested table.                                                              |
  | `portfolio`     | `Portfolio`    | no       | Active engagements and task-pipeline counts. See nested table.                                            |
  | `performance`   | `Performance`  | no       | MTD delivery & quality metrics. See nested table.                                                         |
  | `skills`        | `Skills`       | no       | Verified-skill counts grouped by proficiency. See nested table.                                           |
  | `exams`         | `Exams`        | no       | Current active exam (if any) plus passed-skill count. See nested table.                                   |
  | `onboarding`    | `Onboarding`   | no       | Funnel state. Present even when the consultant has completed onboarding. See nested table.                |
  | `action_counts` | `ActionCounts` | no       | Per-category counts mirrored by the `/action-items` endpoint. See nested table.                           |
  | `generated_at`  | `ISO 8601`     | no       | Snapshot time. When the response came from cache, this is the **cache write** time, not the request time. |

  **`money`** ([`IConsultantDashboardMoney`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)):

  | Field                 | Type     | Notes                                                                                                                                                                                                       |
  | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `currency`            | `string` | ISO 4217. Currently always `USD`.                                                                                                                                                                           |
  | `wallet_balance`      | `string` | Decimal. `consultant_profiles.account_balance` as-is (cleared funds available for withdrawal).                                                                                                              |
  | `pending_credits`     | `string` | Decimal. `SUM(amount) WHERE type = CREDIT_PENDING` — accrued payouts not yet released. Includes all statuses (PENDING/COMPLETED/REVERSED) because CREDIT_PENDING semantics already model the accrual state. |
  | `cleared_credits_mtd` | `string` | Decimal. `SUM(amount) WHERE type = CREDIT_CLEARED AND status = COMPLETED AND created_at IN MTD`.                                                                                                            |
  | `total_withdrawn_mtd` | `string` | Decimal. `SUM(amount) WHERE type = WITHDRAWAL AND status = COMPLETED AND created_at IN MTD`.                                                                                                                |
  | `lifetime_earnings`   | `string` | Decimal. `SUM(amount) WHERE type = CREDIT_CLEARED AND status = COMPLETED` over all time.                                                                                                                    |

  **`portfolio`** ([`IConsultantDashboardPortfolio`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)):

  | Field                     | Type     | Notes                                                                              |
  | ------------------------- | -------- | ---------------------------------------------------------------------------------- |
  | `active_projects`         | `number` | Count of distinct projects where the caller has `project_members.status = ACTIVE`. |
  | `total_tasks_in_progress` | `number` | Caller's tasks currently in `IN_PROGRESS`.                                         |
  | `total_tasks_in_review`   | `number` | Caller's tasks currently in `IN_REVIEW`.                                           |
  | `tasks_completed_mtd`     | `number` | Caller's DONE tasks whose `completed_at` falls in MTD.                             |
  | `tasks_overdue`           | `number` | Caller's tasks with `due_date < NOW()` and status `NOT IN (done, cancelled)`.      |

  **`performance`** ([`IConsultantDashboardPerformance`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)):

  | Field                       | Type     | Nullable | Notes                                                                                                        |
  | --------------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------ |
  | `on_time_pct`               | `string` | yes      | `(on_time / total_done) * 100` over MTD DONE rows that have a `due_date`, one decimal. `null` when none.     |
  | `avg_cycle_days`            | `string` | yes      | Mean (`completed_at - started_at`) in days over caller's DONE rows in MTD, one decimal. `null` when none.    |
  | `avg_rating`                | `string` | yes      | `consultant_profiles.avg_rating` as-is (denormalized across reviewed deliveries). Two decimals when present. |
  | `revisions_requested_count` | `number` | no       | Caller's tasks currently in `REVISION_REQUESTED`.                                                            |

  **`skills`** ([`IConsultantDashboardSkills`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)):

  | Field                   | Type     | Notes                                                                                           |
  | ----------------------- | -------- | ----------------------------------------------------------------------------------------------- |
  | `verified_skills_count` | `number` | Sum of `intermediate_count + senior_count + expert_count` — skills with a non-null proficiency. |
  | `expert_count`          | `number` | `consultant_skills.proficiency_level = EXPERT`.                                                 |
  | `senior_count`          | `number` | `proficiency_level = SENIOR`.                                                                   |
  | `intermediate_count`    | `number` | `proficiency_level = INTERMEDIATE`.                                                             |

  **`exams`** ([`IConsultantDashboardExams`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)):

  | Field                 | Type              | Nullable | Notes                                                                                                                                                                     |
  | --------------------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `active_exam_id`      | `string`          | yes      | UUID of the caller's currently-active exam, or `null` when none.                                                                                                          |
  | `active_skill_name`   | `string`          | yes      | i18n key from `skills.name` (e.g. `skill_react`) — FE translates. `null` when no active exam.                                                                             |
  | `active_status`       | `SkillExamStatus` | yes      | One of `GENERATING_QUESTIONS`, `IN_PROGRESS`, `SUBMITTED`, `RUNNING_COPYLEAKS`, `RUNNING_AI_EVAL`. Terminal statuses are never surfaced here. `null` when no active exam. |
  | `expires_at`          | `ISO 8601`        | yes      | 60-minute deadline once the exam enters `IN_PROGRESS`. `null` for `GENERATING_QUESTIONS` and terminal statuses.                                                           |
  | `total_passed_skills` | `number`          | no       | Distinct skills where the caller has at least one `consultant_skill_exams.status = PASSED` row.                                                                           |

  **`onboarding`** ([`IConsultantDashboardOnboarding`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)):

  | Field           | Type                 | Nullable | Notes                                                                                                                                              |
  | --------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `status`        | `OnboardingStatus`   | yes      | `PENDING_BASIC_INFO`, `IN_INTERVIEW`, `INTERVIEW_SUBMITTED`, `APPROVED`, or `REJECTED`. `null` when no onboarding row exists yet (rare edge case). |
  | `decision`      | `OnboardingDecision` | yes      | `APPROVED` or `REJECTED` — populated once admin review concludes. `null` while the funnel is still in progress.                                    |
  | `blocked_until` | `ISO 8601`           | yes      | If the caller was rejected with a cooldown window. `null` outside that state.                                                                      |
  | `is_approved`   | `boolean`            | no       | Convenience flag — `decision === APPROVED`. Use this when gating UI; `status` carries the funnel detail.                                           |

  **`action_counts`** ([`IConsultantDashboardActionCounts`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-dashboard-summary.response.interface.ts)):

  | Field                      | Type     | Notes                                                                                                                 |
  | -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
  | `revision_requested_tasks` | `number` | Caller's tasks in `REVISION_REQUESTED`. Mirrored by `performance.revisions_requested_count`.                          |
  | `overdue_tasks`            | `number` | Caller's overdue tasks (same definition as `portfolio.tasks_overdue`).                                                |
  | `pending_approval_tasks`   | `number` | Caller's tasks in `IN_REVIEW` **or** `PENDING_APPROVAL` — both are business-side states the consultant is waiting on. |
  | `unread_notifications`     | `number` | `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`.                                          |
  | `pending_withdrawals`      | `number` | Caller's `consultant_transactions` with `type = WITHDRAWAL AND status = PENDING`.                                     |

- **Errors:** cross-cutting only.

---

### 2. Action items queue

- **Endpoint:** `GET /consultant/dashboard/action-items`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** none.

- **Behaviour:** Caches per-consultant for 30 s. On a miss, runs ten parallel
  queries (one per category, one count per category, plus a status-grouped task
  rollup used for the `pending_approval_tasks` total). Each category is capped
  at **5 items**; the matching `total` reflects the unfiltered count so the SPA
  can render "+N more" badges. `days_waiting` on pending-approval items is
  computed server-side as `floor((now - updated_at) / 1 day)`.

- **Response 200:** [`IConsultantActionItemsResponse`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-action-items.response.interface.ts)

  Each top-level field has the shape `{ total: number, items: Item[] }`. The
  item shape is per-category:

  **`revision_requested_tasks.items[]`** — caller's tasks in `REVISION_REQUESTED`, most-recently-bounced first:

  | Field                        | Type       | Nullable | Notes                                                                        |
  | ---------------------------- | ---------- | -------- | ---------------------------------------------------------------------------- |
  | `task_id`                    | `string`   | no       | UUID.                                                                        |
  | `task_code`                  | `string`   | no       | Human-facing code (e.g. `WEB-23`).                                           |
  | `title`                      | `string`   | no       | Task title.                                                                  |
  | `project_id`                 | `string`   | no       | Owning project UUID.                                                         |
  | `project_title`              | `string`   | no       | Owning project title.                                                        |
  | `kanban_status`              | `string`   | no       | Always `revision_requested` for this category — included for FE convenience. |
  | `due_date`                   | `ISO 8601` | yes      | Optional due date when the task carries one.                                 |
  | `last_revision_requested_at` | `ISO 8601` | no       | `task.updated_at` — when the row most recently entered `REVISION_REQUESTED`. |

  **`overdue_tasks.items[]`** — caller's tasks with `due_date < NOW()` not done/cancelled, soonest-due first:

  | Field           | Type       | Notes                                                             |
  | --------------- | ---------- | ----------------------------------------------------------------- |
  | `task_id`       | `string`   | UUID.                                                             |
  | `task_code`     | `string`   | Human-facing code.                                                |
  | `title`         | `string`   | Task title.                                                       |
  | `project_id`    | `string`   | Owning project UUID.                                              |
  | `project_title` | `string`   | Owning project title.                                             |
  | `kanban_status` | `string`   | Real status of the overdue row (e.g. `in_progress`, `in_review`). |
  | `due_date`      | `ISO 8601` | Original due date.                                                |
  | `days_overdue`  | `number`   | Integer days past `due_date` (server-computed via Postgres).      |

  **`pending_approval_tasks.items[]`** — caller's tasks waiting on the business (`IN_REVIEW` or `PENDING_APPROVAL`), oldest first:

  | Field           | Type       | Notes                                                               |
  | --------------- | ---------- | ------------------------------------------------------------------- |
  | `task_id`       | `string`   | UUID.                                                               |
  | `task_code`     | `string`   | Human-facing code.                                                  |
  | `title`         | `string`   | Task title.                                                         |
  | `project_id`    | `string`   | Owning project UUID.                                                |
  | `project_title` | `string`   | Owning project title.                                               |
  | `kanban_status` | `string`   | `in_review` or `pending_approval`.                                  |
  | `submitted_at`  | `ISO 8601` | `task.updated_at` — when the row entered the current waiting state. |
  | `days_waiting`  | `number`   | Whole days since `submitted_at`. Floor'd, never negative.           |

  **`recent_notifications.items[]`** — caller's most-recent unread notifications, newest first. `total` is the **full unread count**, not capped:

  | Field             | Type       | Nullable | Notes                                                                |
  | ----------------- | ---------- | -------- | -------------------------------------------------------------------- |
  | `notification_id` | `string`   | no       | `notifications.id` UUID.                                             |
  | `type`            | `string`   | no       | Discriminator (e.g. `task_revision_requested`).                      |
  | `title`           | `string`   | no       | Localized at write time. Already translated.                         |
  | `body`            | `string`   | no       | Localized at write time. Already translated.                         |
  | `redirect_url`    | `string`   | yes      | Deep-link the FE can open. `null` when the notification has no link. |
  | `created_at`      | `ISO 8601` | no       | When the row was inserted.                                           |

  **`pending_withdrawals.items[]`** — caller's `consultant_transactions.type = WITHDRAWAL AND status = PENDING`, most-recent first:

  | Field                | Type       | Nullable | Notes                                                                                         |
  | -------------------- | ---------- | -------- | --------------------------------------------------------------------------------------------- |
  | `transaction_id`     | `string`   | no       | UUID.                                                                                         |
  | `transaction_number` | `string`   | no       | Human-facing number (e.g. `PLNWDR202605120001`).                                              |
  | `amount`             | `string`   | no       | Decimal payout amount.                                                                        |
  | `withdrawal_method`  | `string`   | yes      | `consultant_transactions.withdrawal_method` (e.g. `stripe_connect`). `null` when unspecified. |
  | `created_at`         | `ISO 8601` | no       | When the withdrawal was opened.                                                               |

  The root response also carries `generated_at: ISO 8601` once.

- **Errors:** cross-cutting only.

---

### 3. Earnings trend

- **Endpoint:** `GET /consultant/dashboard/earnings-trend`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`ConsultantEarningsTrendDto`](../../../../apps/consultant-service/src/modules/statistics/dto/requests/consultant-earnings-trend.dto.ts)

  | Field         | Type            | Required | Constraints                              | Notes                                                                                              |
  | ------------- | --------------- | -------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
  | `from`        | `ISO 8601`      | no       | ISO 8601 string                          | Inclusive lower bound on `created_at`. Defaults to **6 calendar months before `to`** when omitted. |
  | `to`          | `ISO 8601`      | no       | ISO 8601 string                          | Inclusive upper bound on `created_at`. Defaults to the current server time when omitted.           |
  | `granularity` | `month \| week` | no       | one of `month`, `week` (default `month`) | Bucket size. `month` → `YYYY-MM`; `week` → ISO `IYYY-IW`.                                          |

- **Behaviour:** Single grouped query on the ledger filtered to
  `CREDIT_CLEARED + CREDIT_PENDING + WITHDRAWAL` rows, bucketing by
  `(period_label, type)`. The service merges the three rows per period into a
  single point with separate `earned`, `pending`, `withdrawn` columns, then
  walks the ordered list once to compute `cumulative_earned`. Periods with no
  activity are absent from the array (no zero-fill) — the FE is expected to
  render gaps as zero when drawing the chart.

  Note: `CREDIT_PENDING` rows are counted by their `created_at` regardless of
  `status` since the accrual state itself is the metric. `CREDIT_CLEARED` and
  `WITHDRAWAL` rows are bucketed only when `status = COMPLETED` (a `REVERSED`
  row writes an opposite-sign row rather than mutating the original).

- **Response 200:** [`IConsultantEarningsTrendResponse`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-earnings-trend.response.interface.ts)

  | Field          | Type            | Notes                                          |
  | -------------- | --------------- | ---------------------------------------------- |
  | `currency`     | `string`        | ISO 4217. Currently `USD`.                     |
  | `granularity`  | `month \| week` | Echoed from the request.                       |
  | `points`       | `TrendPoint[]`  | Ascending by `period_label`. See nested table. |
  | `generated_at` | `ISO 8601`      | Snapshot time (not cached).                    |

  **`points[]`**:

  | Field               | Type     | Notes                                                                                |
  | ------------------- | -------- | ------------------------------------------------------------------------------------ |
  | `period_label`      | `string` | `YYYY-MM` (monthly) or `IYYY-IW` (weekly).                                           |
  | `earned`            | `string` | Decimal sum of CREDIT_CLEARED inside this bucket.                                    |
  | `pending`           | `string` | Decimal sum of CREDIT_PENDING inside this bucket.                                    |
  | `withdrawn`         | `string` | Decimal sum of completed WITHDRAWAL rows inside this bucket.                         |
  | `cumulative_earned` | `string` | Running sum of `earned` from the first bucket in the response to this one inclusive. |

- **Errors:** cross-cutting only.

---

### 4. Project progress

- **Endpoint:** `GET /consultant/dashboard/project-progress`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`ConsultantProjectProgressDto`](../../../../apps/consultant-service/src/modules/statistics/dto/requests/consultant-project-progress.dto.ts)

  | Field    | Type            | Required | Constraints                     | Notes                                                                                              |
  | -------- | --------------- | -------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
  | `status` | `ProjectStatus` | no       | valid enum value                | Optional single-status filter applied to `project.status`. When omitted, every status is included. |
  | `limit`  | `number`        | no       | min `1`, max `50`, default `20` | Max rows in the response.                                                                          |

- **Behaviour:**
  1. Pulls the caller's ACTIVE memberships (eager-loaded with `project`),
     ordered `joined_at DESC`. Empty array short-circuits to a `{ projects: [],
generated_at }` response.
  2. In parallel: per-project status breakdown over the caller's assigned tasks
     (single grouped query with an overdue sub-count), latest `task.updated_at`
     per project, and cleared earnings per project from
     `consultant_transactions`.
  3. The service folds the status counts into `my_assigned_tasks` (active
     statuses: assigned + in_progress + in_review + pending_approval +
     revision_requested), `my_in_review_tasks` (in_review + pending_approval),
     and the rest. Derives `my_completion_pct` as
     `completed / (active + completed) * 100`, one decimal, `null` when both
     sides are zero.
  4. `is_at_risk = my_overdue_tasks > 0 OR my_revision_requested_tasks > 0`.
  5. Rows sort at-risk first, then by `last_activity_at` DESC (null last).

- **Response 200:** [`IConsultantProjectProgressResponse`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-project-progress.response.interface.ts)

  Top-level: `projects: ProjectProgress[]`, `generated_at: ISO 8601`.

  **`projects[]`**:

  | Field                         | Type                 | Nullable | Notes                                                                                                                                              |
  | ----------------------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `project_id`                  | `string`             | no       | UUID.                                                                                                                                              |
  | `code`                        | `string`             | no       | Project code (e.g. `WEB`).                                                                                                                         |
  | `title`                       | `string`             | no       | Project title.                                                                                                                                     |
  | `status`                      | `ProjectStatus`      | no       | Current lifecycle status.                                                                                                                          |
  | `payment_type`                | `ProjectPaymentType` | no       | `per_task` or `per_month`.                                                                                                                         |
  | `joined_at`                   | `ISO 8601`           | no       | `project_members.joined_at`.                                                                                                                       |
  | `my_assigned_tasks`           | `number`             | no       | Caller's tasks in any active status (assigned / in_progress / in_review / pending_approval / revision_requested). Excludes DONE / CANCELLED.       |
  | `my_in_progress_tasks`        | `number`             | no       | Caller's tasks in `IN_PROGRESS`.                                                                                                                   |
  | `my_in_review_tasks`          | `number`             | no       | Caller's tasks in `IN_REVIEW` **or** `PENDING_APPROVAL` (both are business-side states).                                                           |
  | `my_completed_tasks`          | `number`             | no       | Caller's `DONE` tasks (lifetime — no window).                                                                                                      |
  | `my_overdue_tasks`            | `number`             | no       | Caller's overdue tasks in this project.                                                                                                            |
  | `my_revision_requested_tasks` | `number`             | no       | Caller's tasks in `REVISION_REQUESTED`.                                                                                                            |
  | `my_completion_pct`           | `string`             | yes      | `(my_completed / (my_assigned + my_completed)) * 100`, one decimal. `null` when both sides are zero.                                               |
  | `my_earnings_in_project`      | `string`             | no       | Decimal sum of `consultant_transactions.amount` where `consultant_id = caller AND project_id = row AND type = CREDIT_CLEARED`. `"0.00"` when none. |
  | `last_activity_at`            | `ISO 8601`           | yes      | Latest `task.updated_at` across the caller's tasks in this project. `null` when the caller has no tasks here yet.                                  |
  | `is_at_risk`                  | `boolean`            | no       | `my_overdue_tasks > 0 OR my_revision_requested_tasks > 0`.                                                                                         |

- **Errors:** cross-cutting only.

---

### 5. Skill performance

- **Endpoint:** `GET /consultant/dashboard/skill-performance`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`ConsultantSkillPerformanceDto`](../../../../apps/consultant-service/src/modules/statistics/dto/requests/consultant-skill-performance.dto.ts)

  | Field   | Type                                                   | Required | Constraints                         | Notes                                                                                 |
  | ------- | ------------------------------------------------------ | -------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
  | `limit` | `number`                                               | no       | min `1`, max `50`, default `20`     | Max rows after sorting.                                                               |
  | `sort`  | `completed_tasks_desc \| earnings_desc \| rating_desc` | no       | one of those values (default first) | Metric to sort by. `rating_desc` is null-aware: rows without an exam score land last. |

- **Behaviour:**
  1. Pulls the caller's `consultant_skills` rows (eager-loaded with `skill`).
     Empty array short-circuits to a `{ skills: [], generated_at }` response.
  2. In parallel: PASSED-exam counts grouped by skill, latest passing-score
     `calculated_at` per skill, active-project counts where the project
     requires each skill, and DONE-task counts where the project required each
     skill. Per-skill earnings are summed via one query per skill (fan-out
     bounded by the caller's declared skills, never the request `limit`).
  3. The service builds row items, applies the requested sort, then slices to
     `limit` (so sort runs over the full skill set, not the truncated one).

  **Multi-skill earnings/task caveat.** A project may list several required
  skills. A single earning row or DONE task on such a project contributes to
  _every_ matching skill's column — the intent is "which skills earn this
  consultant the most" rather than a partitioned share. The same applies to
  `active_projects_count` and `tasks_completed_lifetime`. Surface this in the
  UI copy if you display absolute totals.

- **Response 200:** [`IConsultantSkillPerformanceResponse`](../../../../apps/consultant-service/src/modules/statistics/dto/responses/interfaces/consultant-skill-performance.response.interface.ts)

  Top-level: `skills: SkillPerformance[]`, `generated_at: ISO 8601`.

  **`skills[]`**:

  | Field                      | Type               | Nullable | Notes                                                                                                                                       |
  | -------------------------- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
  | `skill_id`                 | `string`           | no       | `skills.id` UUID.                                                                                                                           |
  | `skill_name`               | `string`           | no       | i18n key from `skills.name` (e.g. `skill_react`) — FE translates.                                                                           |
  | `proficiency_level`        | `ProficiencyLevel` | yes      | `BEGINNER`, `INTERMEDIATE`, `SENIOR`, or `EXPERT`. `null` for skills the consultant declared but never certified.                           |
  | `exam_score`               | `string`           | yes      | Latest passing score (0–100). Two decimals when present. `null` when no exam has passed.                                                    |
  | `last_certified_at`        | `ISO 8601`         | yes      | `MAX(consultant_skill_scores.calculated_at)` for this `(consultant, skill)`. `null` when never certified.                                   |
  | `total_passed_exams`       | `number`           | no       | `COUNT(consultant_skill_exams WHERE status = PASSED)` for this skill.                                                                       |
  | `active_projects_count`    | `number`           | no       | Distinct ACTIVE memberships where the project lists this skill as required. Multi-skill caveat applies.                                     |
  | `tasks_completed_lifetime` | `number`           | no       | Caller's DONE tasks on projects that required this skill. Multi-skill caveat applies.                                                       |
  | `earnings_from_skill`      | `string`           | no       | Decimal sum of CREDIT_CLEARED `amount` on tasks belonging to projects requiring this skill. `"0.00"` when none. Multi-skill caveat applies. |

- **Errors:** cross-cutting only.
