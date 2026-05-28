# BusinessProjectOverviewController — API Specs

> **Source:** [apps/business-service/src/modules/business-projects/controllers/overview.controller.ts](../../../../apps/business-service/src/modules/business-projects/controllers/overview.controller.ts)
> **Base path:** `/api/v1/projects/business`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@UseGuards(RolesGuard, PlatformGuard)` + `@Roles(UserRole.USER)` + `@Platform(ActivePlatform.BUSINESS)`. The global `JwtAuthGuard` enforces auth before the role/platform check runs.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract).
> **Refactor note (breaking):** this surface replaces the previous engineering-flavoured shape (`statistics`, `task_statuses`, `team_members`, `application_breakdown`, `recent_activity`). Clients must migrate to the six blocks documented below.
> **Caching:** per-project Redis cache, 30 s TTL. Key `business:project:overview:{projectId}:v1`. Cache writes are best-effort — a Redis outage degrades to direct-DB reads, not a 5xx.

## Cross-cutting errors

| HTTP | error_code                   | When                                                                                           |
| ---- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token (global `JwtAuthGuard`).                                          |
| 403  | (forbidden, no error_code)   | Caller is authenticated but not `UserRole.USER` / `ActivePlatform.BUSINESS`.                   |
| 403  | `BUSINESS_PROFILE_NOT_FOUND` | Caller is on the BUSINESS platform but the JWT `businessId` does not match the user's profile. |
| 404  | `PROJECT_NOT_FOUND`          | Project id does not exist or does not belong to the calling business.                          |
| 422  | (validation)                 | `:id` path param fails `ParseUUIDPipe` (e.g. malformed UUID).                                  |

---

## Endpoint

### Project overview

- **Endpoint:** `GET /projects/business/:id/overview`
- **Method:** `GET`
- **Status:** `200 OK`
- **Path params:** `id` — project UUID (`ParseUUIDPipe`).
- **Query params:** none.

- **Behaviour:**
  1. Resolves the caller's `BusinessProfile`, then loads the project via
     `findByIdAndBusinessId` (404 on miss). Both checks happen inside
     `BusinessAccessService.resolveOwnedProject`.
  2. Tries `business:project:overview:{projectId}:v1` in Redis. On hit, the
     cached payload is returned unchanged.
  3. On miss, fetches the active project-member roster and the project's
     required-skill ids first, then fan-outs ~13 sub-aggregates in parallel
     (`Promise.all`). Merges per-consultant performance + skill rows onto each
     team-member entry, derives `is_at_risk` from health, formats every money
     value via `Money.from(...).toFixedString()`.
  4. Stamps `generated_at` at compute time and writes back to Redis with a
     30 s TTL. Failures here log a warning and proceed.

- **Response 200:** [`IOverviewResponse`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts)

  | Field          | Type           | Notes                                                                                                      |
  | -------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
  | `summary`      | `Summary`      | Project header (id, code, title, status, payment_type, lifecycle dates, owning business name).             |
  | `health`       | `Health`       | Owner's "how is this project doing" block — task counters, momentum, at-risk flag.                         |
  | `money`        | `Money`        | Spent-on-publish + spent-on-tasks + total + pipeline + (for PER_MONTH) projected monthly bill.             |
  | `team`         | `TeamMember[]` | Active consultants on the project with per-member performance and skill rows.                              |
  | `action_items` | `ActionItems`  | Top-5 per category — tasks awaiting review, overdue tasks, open disputes — plus per-category totals.       |
  | `activity`     | `Event[]`      | Most-recent 20 `ProjectActivity` rows (same shape as before).                                              |
  | `generated_at` | `ISO 8601`     | Snapshot time. When the response comes from cache, this is the **cache-write** time, not the request time. |

  ### `summary` ([`IOverviewSummary`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts))

  | Field                   | Type                 | Nullable | Notes                                                                        |
  | ----------------------- | -------------------- | -------- | ---------------------------------------------------------------------------- |
  | `id`                    | `string`             | no       | Project UUID.                                                                |
  | `code`                  | `string`             | no       | Human-facing project code (e.g. `WEB`).                                      |
  | `title`                 | `string`             | no       |                                                                              |
  | `status`                | `ProjectStatus`      | no       | `draft` / `configured` / `published` / `in_progress` / `done` / `cancelled`. |
  | `payment_type`          | `ProjectPaymentType` | no       | `per_task` or `per_month`.                                                   |
  | `business_company_name` | `string`             | no       | Owning business `companyName`.                                               |
  | `required_consultants`  | `number`             | no       | Headcount target from the project config.                                    |
  | `created_at`            | `ISO 8601`           | no       | UTC. The SPA formats per its locale; no server-side re-zoning.               |
  | `published_at`          | `ISO 8601`           | yes      | `null` until first publish.                                                  |
  | `started_at`            | `ISO 8601`           | yes      | `null` until any task transitions to IN_PROGRESS.                            |
  | `completed_at`          | `ISO 8601`           | yes      | `null` unless the project moved to DONE.                                     |

  ### `health` ([`IOverviewHealth`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts))

  | Field                     | Type       | Nullable | Notes                                                                                |
  | ------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------ |
  | `total_tasks`             | `number`   | no       | All non-deleted tasks (any kanban status).                                           |
  | `completed_tasks`         | `number`   | no       | `kanban_status = DONE`.                                                              |
  | `in_review_tasks`         | `number`   | no       | `kanban_status = IN_REVIEW`. Mirrored in `action_items.tasks_awaiting_review.total`. |
  | `in_progress_tasks`       | `number`   | no       | `kanban_status = IN_PROGRESS`.                                                       |
  | `overdue_tasks`           | `number`   | no       | `due_date < NOW()` and status NOT IN (done, cancelled).                              |
  | `completion_pct`          | `string`   | yes      | `(completed / total) * 100`, one decimal. `null` when `total = 0`.                   |
  | `tasks_completed_last_7d` | `number`   | no       | `completed_at` in last 7 days.                                                       |
  | `open_disputes`           | `number`   | no       | `task_disputes.status = OPEN` for tasks in this project.                             |
  | `is_at_risk`              | `boolean`  | no       | `overdue_tasks > 0` OR (`in_review > 0` AND `oldest_in_review > 7 days ago`).        |
  | `last_activity_at`        | `ISO 8601` | yes      | Latest `task.updated_at` across the project; `null` when the project has no tasks.   |

  ### `money` ([`IOverviewMoney`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts))

  | Field                        | Type     | Nullable | Notes                                                                                                                               |
  | ---------------------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | `currency`                   | `string` | no       | ISO 4217. Currently `USD`.                                                                                                          |
  | `spent_on_publish`           | `string` | no       | Decimal. `SUM(total_amount)` of COMPLETED `PROJECT_PUBLISHED` rows for this project.                                                |
  | `spent_on_tasks`             | `string` | no       | Decimal. `SUM(total_amount)` of COMPLETED `TASK_ADDED` rows for this project.                                                       |
  | `total_spent`                | `string` | no       | `spent_on_publish + spent_on_tasks`. Computed server-side so the SPA doesn't have to coerce string arithmetic.                      |
  | `unpublished_pipeline_value` | `string` | no       | Decimal. `SUM(task.price)` for DRAFT tasks in this project.                                                                         |
  | `projected_monthly_bill`     | `string` | yes      | PER_MONTH projects only. Sum of TASK_ADDED rows linked to the business's OPEN billing period AND this project. `null` for PER_TASK. |

  ### `team[]` ([`IOverviewTeamMember`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts))

  | Field               | Type                        | Nullable | Notes                                                                                                              |
  | ------------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
  | `consultant_id`     | `string`                    | no       | `consultant_profiles.id`.                                                                                          |
  | `full_name`         | `string`                    | no       |                                                                                                                    |
  | `avatar_url`        | `string`                    | yes      |                                                                                                                    |
  | `active_status`     | `ProjectMemberActiveStatus` | no       | `ACTIVE` (< 8 h), `IDLE` (< 48 h), `INACTIVE` (else). Derived from `users.last_login_at` against the request time. |
  | `joined_at`         | `ISO 8601`                  | no       | `project_members.joined_at`.                                                                                       |
  | `completed_tasks`   | `number`                    | no       | DONE tasks completed by this consultant on this project in the **current month-to-date** window.                   |
  | `in_progress_tasks` | `number`                    | no       | Currently IN_PROGRESS on this project (window-independent).                                                        |
  | `avg_cycle_days`    | `string`                    | yes      | Mean (`completed_at - started_at`) days over MTD DONE rows, one decimal. `null` when no qualifying rows.           |
  | `on_time_pct`       | `string`                    | yes      | `(on_time / total_done) * 100` over DONE rows that have a `due_date`, one decimal. `null` when no qualifying rows. |
  | `skills`            | `TeamSkill[]`               | no       | Empty array when the consultant has none recorded. See nested table.                                               |

  **`skills[]`** ([`IOverviewTeamSkill`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts)):

  | Field               | Type               | Nullable | Notes                                                                                          |
  | ------------------- | ------------------ | -------- | ---------------------------------------------------------------------------------------------- |
  | `skill_id`          | `string`           | no       |                                                                                                |
  | `skill_name`        | `string`           | no       | i18n key from `skills.name` (e.g. `skill_react`). FE translates.                               |
  | `proficiency_level` | `ProficiencyLevel` | yes      | `BEGINNER` / `INTERMEDIATE` / `SENIOR` / `EXPERT`. `null` until the exam pipeline assigns one. |
  | `rating`            | `string`           | yes      | 0–100 decimal from the latest passing exam, or `null`.                                         |
  | `is_required`       | `boolean`          | no       | `true` when this `skill_id` is in `project_required_skills` for the project.                   |

  ### `action_items` ([`IOverviewActionItems`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts))

  Each category has the shape `{ total: number, items: Item[] }`. Categories are capped at **5 items**; the `total` reflects the unfiltered count so the SPA can render "+N more" badges.
  - **`tasks_awaiting_review.items[]`** — tasks currently in `IN_REVIEW`, oldest first. Item fields: `task_id`, `task_code`, `title`, `reference_at` (entered IN_REVIEW timestamp = `task.updated_at`), `days_overdue: null`.
  - **`overdue_tasks.items[]`** — `due_date < NOW()` and not done/cancelled, soonest-due first. Same item fields as above, with `reference_at = due_date` and `days_overdue` = integer days past `due_date` (server-computed).
  - **`open_disputes.items[]`** — `task_disputes.status = OPEN`, oldest first. Item fields: `dispute_id`, `task_id`, `task_code`, `reason_snippet` (first 120 chars of `reason`, server-trimmed), `opened_at`.

  ### `activity[]` ([`IOverviewActivityEvent`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts))

  Same row shape as before this refactor. Most-recent 20 events.

  | Field         | Type                       | Nullable | Notes                                                              |
  | ------------- | -------------------------- | -------- | ------------------------------------------------------------------ |
  | `event_type`  | `ProjectActivityEventType` | no       |                                                                    |
  | `event_id`    | `string`                   | no       |                                                                    |
  | `occurred_at` | `ISO 8601`                 | no       |                                                                    |
  | `actor`       | `{ user_id, name }`        | no       | Either both populated, or both `null` for system-generated events. |
  | `payload`     | `Record<string, unknown>`  | no       | Event-type-specific metadata.                                      |

- **Errors:** cross-cutting only.
