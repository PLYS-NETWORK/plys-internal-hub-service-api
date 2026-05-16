# AdminStatisticsController — API Specs

> **Source:** [src/modules/statistics/admin/admin-statistics.controller.ts](../../../src/modules/statistics/admin/admin-statistics.controller.ts)
> **Base path:** `/admin/dashboard`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@Roles(UserRole.ADMIN_PLATFORM)` + `@UseGuards(RolesGuard)`. Non-admin callers receive `403`. No `@Platform` — admins are platform-wide. The global `JwtAuthGuard` enforces auth before the role check runs.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).
> **Aggregation scope:** these endpoints aggregate **platform-wide** — no `business_id` / `consultant_id` filter, no caller-profile scoping. The aim is the admin SPA's landing screen.
> **Caching:** `summary` and `operational-queues` are cached in Redis for 60 seconds (`admin:dashboard:summary:v1`, `admin:dashboard:queues:v1`). Cache writes are best-effort — a Redis outage degrades to direct-DB reads, not a 5xx. `users-breakdown` and `growth-trend` skip cache (light queries / query-string-dependent).

## Cross-cutting errors

| HTTP | error_code                 | When                                                                                                               |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`        | Missing/invalid Bearer token (global `JwtAuthGuard`).                                                              |
| 403  | (forbidden, no error_code) | Caller is authenticated but not `UserRole.ADMIN_PLATFORM`.                                                         |
| 422  | (validation)               | DTO shape failures from `class-validator` — invalid ISO date in `from`/`to`, `granularity` outside `month`/`week`. |

---

## Endpoints

### 1. Batched KPI summary

- **Endpoint:** `GET /admin/dashboard/summary`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** none.

- **Behaviour:**
  1. Tries `admin:dashboard:summary:v1` in Redis. On hit, returns the cached payload.
  2. On miss, fires the 13 sub-aggregates in parallel (`Promise.all`):
     - Users by platform × status; new users MTD; MTD GMV; MTD payouts; outstanding payouts (consultant wallet balances); outstanding invoices; previous-month GMV; previous-month payouts; queue counts ×5.
  3. Computes `gmv_delta_pct` and `payouts_delta_pct` vs the previous full calendar month, rounded to one decimal place (special cases: `prev = 0, curr = 0 → "0.0"`; `prev = 0, curr > 0 → "100.0"`).
  4. Stamps `generated_at` with the live request time.
  5. Writes back to Redis with a 60 s TTL; failures here log a warning and proceed.

- **Response 200:** [`IAdminDashboardSummaryResponse`](../../../src/modules/statistics/dto/responses/interfaces/admin-dashboard-summary.response.interface.ts)

  | Field          | Type       | Nullable | Notes                                                                                                     |
  | -------------- | ---------- | -------- | --------------------------------------------------------------------------------------------------------- |
  | `users`        | `Users`    | no       | Per-platform user counts. See nested table below.                                                         |
  | `financial`    | `Money`    | no       | Currency, MTD GMV, MTD payouts, outstanding payouts, outstanding invoices. See nested table.              |
  | `queues`       | `Queues`   | no       | Counts of items needing human attention. See nested table.                                                |
  | `growth`       | `Growth`   | no       | New users MTD per platform plus deltas vs previous month. See nested table.                               |
  | `generated_at` | `ISO 8601` | no       | Snapshot time. When the response came from cache, this is the **cache write** time, not the request time. |

  **`users.business` and `users.consultant`** ([`IAdminUsersStatusCounts`](../../../src/modules/statistics/dto/responses/interfaces/admin-dashboard-summary.response.interface.ts)):

  | Field        | Type     | Notes                                                                                                             |
  | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
  | `total`      | `number` | Total users on the platform (regardless of state).                                                                |
  | `active_30d` | `number` | `is_active = true AND banned_at IS NULL AND last_login_at >= now() - 30 days`.                                    |
  | `unverified` | `number` | `is_email_verified = false`. Overlaps with the other buckets — an unverified user can also be inactive or banned. |
  | `banned`     | `number` | `banned_at IS NOT NULL`.                                                                                          |

  **`financial`** ([`IAdminFinancialSummary`](../../../src/modules/statistics/dto/responses/interfaces/admin-dashboard-summary.response.interface.ts)):

  | Field                  | Type     | Notes                                                                                                                                                                          |
  | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `currency`             | `string` | ISO 4217. Currently always `USD`.                                                                                                                                              |
  | `mtd_gmv`              | `string` | Decimal. Sum of `business_transactions.total_amount` where `status = COMPLETED AND type IN (top_up, monthly_billing)` between the first of the current calendar month and now. |
  | `mtd_payouts`          | `string` | Decimal. Sum of `consultant_transactions.amount` where `status = COMPLETED AND type = WITHDRAWAL` over the same window.                                                        |
  | `outstanding_payouts`  | `string` | Decimal. `SUM(consultant_profiles.account_balance)` — money owed to consultants that hasn't been withdrawn yet.                                                                |
  | `outstanding_invoices` | `string` | Decimal. `SUM(invoices.amount) WHERE status IN (pending, overdue)`.                                                                                                            |

  **`queues`** ([`IAdminOperationalQueuesSummary`](../../../src/modules/statistics/dto/responses/interfaces/admin-dashboard-summary.response.interface.ts)):

  | Field                            | Type     | Notes                                                                                                |
  | -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
  | `pending_consultant_onboardings` | `number` | `consultant_onboardings.status = INTERVIEW_SUBMITTED` — waiting for the admin decision endpoint.     |
  | `skill_exams_awaiting_review`    | `number` | `consultant_skill_exams.status IN (SUBMITTED, COPYLEAKS_FAILED)` — pipeline stalls / manual retries. |
  | `open_task_disputes`             | `number` | `task_disputes.status = OPEN`.                                                                       |
  | `overdue_invoices`               | `number` | `invoices.status = OVERDUE`.                                                                         |
  | `pending_consultant_withdrawals` | `number` | `consultant_transactions.type = WITHDRAWAL AND status = PENDING`.                                    |

  **`growth`** ([`IAdminGrowthSummary`](../../../src/modules/statistics/dto/responses/interfaces/admin-dashboard-summary.response.interface.ts)):

  | Field                 | Type     | Notes                                                                                                                                         |
  | --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
  | `new_consultants_mtd` | `number` | New consultant users created since the first of the current calendar month.                                                                   |
  | `new_businesses_mtd`  | `number` | New business users created since the first of the current calendar month.                                                                     |
  | `gmv_delta_pct`       | `string` | `(mtd_gmv − prev_month_gmv) / prev_month_gmv × 100`, one decimal. `'0.0'` when both periods are 0; `'100.0'` when `prev = 0` and current > 0. |
  | `payouts_delta_pct`   | `string` | Same formula for consultant payouts.                                                                                                          |

- **Errors:** cross-cutting only.

---

### 2. Users breakdown

- **Endpoint:** `GET /admin/dashboard/users-breakdown`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** none.

- **Behaviour:** Single SQL aggregate (`COUNT(*) FILTER (...)` for each of the four status buckets, grouped by `platform`). Not cached — the underlying query is one round-trip.

- **Response 200:** [`IAdminUsersBreakdownResponse`](../../../src/modules/statistics/dto/responses/interfaces/admin-users-breakdown.response.interface.ts) — same shape as `summary.users` (`business` + `consultant` blocks, both `IAdminUsersStatusCounts`). See the table in §1.

- **Errors:** cross-cutting only.

---

### 3. Growth trend

- **Endpoint:** `GET /admin/dashboard/growth-trend`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** [`AdminGrowthTrendDto`](../../../src/modules/statistics/dto/requests/admin-growth-trend.dto.ts)

  | Field         | Type            | Required | Constraints                              | Notes                                                                                              |
  | ------------- | --------------- | -------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
  | `from`        | `ISO 8601`      | no       | ISO 8601 string                          | Inclusive lower bound on `created_at`. Defaults to **6 calendar months before `to`** when omitted. |
  | `to`          | `ISO 8601`      | no       | ISO 8601 string                          | Inclusive upper bound on `created_at`. Defaults to the current server time when omitted.           |
  | `granularity` | `month \| week` | no       | one of `month`, `week` (default `month`) | Bucket size. `month` → `YYYY-MM`; `week` → ISO `IYYY-IW`.                                          |

- **Behaviour:**
  1. Resolves the window (defaults applied as above).
  2. Fans out three grouped aggregates in parallel (new-users per platform, GMV, payouts).
  3. Aligns the three series onto a single set of `period_label`s. Buckets with no rows for a given metric land as `0` / `'0.00'` — never absent — so the FE can draw a contiguous chart.
  4. Sorts ascending by `period_label`.

- **Response 200:** [`IAdminGrowthTrendResponse`](../../../src/modules/statistics/dto/responses/interfaces/admin-growth-trend.response.interface.ts)

  | Field         | Type                      | Notes                                                           |
  | ------------- | ------------------------- | --------------------------------------------------------------- |
  | `granularity` | `month \| week`           | Echoed from the request so the FE doesn't have to remember.     |
  | `currency`    | `string`                  | ISO 4217 for the `gmv` / `payouts` columns. Always `USD` today. |
  | `points`      | `AdminGrowthTrendPoint[]` | Ascending by `period_label`. See nested table.                  |

  **`points[]`** ([`IAdminGrowthTrendPoint`](../../../src/modules/statistics/dto/responses/interfaces/admin-growth-trend.response.interface.ts)):

  | Field             | Type     | Notes                                                                               |
  | ----------------- | -------- | ----------------------------------------------------------------------------------- |
  | `period_label`    | `string` | `YYYY-MM` (monthly) or `IYYY-IW` (weekly, ISO).                                     |
  | `new_consultants` | `number` | Consultant users created in this bucket.                                            |
  | `new_businesses`  | `number` | Business users created in this bucket.                                              |
  | `gmv`             | `string` | Decimal. Sum of completed `TOP_UP + MONTHLY_BILLING` `total_amount` in this bucket. |
  | `payouts`         | `string` | Decimal. Sum of completed consultant `WITHDRAWAL` `amount` in this bucket.          |

- **Errors:** cross-cutting only.

---

### 4. Operational queues

- **Endpoint:** `GET /admin/dashboard/operational-queues`
- **Method:** `GET`
- **Status:** `200 OK`
- **Query params:** none.

- **Behaviour:** Cached identically to `summary` (60 s, `admin:dashboard:queues:v1`). On a miss, runs the five queue COUNTs in parallel.

- **Response 200:** [`IAdminOperationalQueuesResponse`](../../../src/modules/statistics/dto/responses/interfaces/admin-operational-queues.response.interface.ts)

  | Field          | Type       | Notes                                                              |
  | -------------- | ---------- | ------------------------------------------------------------------ |
  | `counts`       | `Queues`   | Same shape as `summary.queues` — see §1 for per-field definitions. |
  | `generated_at` | `ISO 8601` | Snapshot time (cache-write time on a hit).                         |

- **Errors:** cross-cutting only.
