# BusinessProjectOverviewController — API Specs

> **Source:** [src/modules/business-projects/controllers/overview.controller.ts](../../../../src/modules/business-projects/controllers/overview.controller.ts)
> **Base path:** `/projects/business`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). The linked interface files contain the typed shape.

## Cross-cutting errors

| HTTP | error_code                                    | When                                   |
| ---- | --------------------------------------------- | -------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.          |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile. |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.       |
| 422  | (validation)                                  | Invalid `:id` UUID.                    |

## Endpoints

### 1. Project overview (single aggregated payload)

- **Endpoint:** `GET /projects/business/:id/overview`
- **Method:** `GET`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Path params:** `id` (UUID v4)
- **Response 200:** [`IOverviewResponse`](../../../../src/modules/business-projects/dto/responses/interfaces/overview.response.interface.ts)

  ```ts
  {
    summary: { title, created_at, updated_at, published_at, business_company_name, status, payment_type, project_cost },
    statistics: { total_tasks, completed_tasks, in_progress_tasks, total_project_members,
                  total_pending_applications, total_applications, total_approved, total_rejected },
    task_statuses: { draft, to_do, assigned, in_progress, in_review, pending_approval,
                     revision_requested, done, cancelled },
    team_members: [{ consultant_id, full_name, avatar_url, active_status }],
    application_breakdown: { pending, accepted, rejected, withdrawn, approval_rate },
    recent_activity: [{ event_type, event_id, occurred_at, actor: { user_id, name }, payload }] // up to 20
  }
  ```

  `summary.payment_type` is the project-level payout mode set by the business at creation:
  `per_task` (default — each task is paid on completion) or `per_month` (members are billed
  monthly for the period worked).

- **Errors:** cross-cutting only (read-only endpoint).

---

## FE rendering suggestions

The overview endpoint is the dashboard top-page — one round trip, multiple panels. Below is a per-field suggestion for what UI element to bind to each value.

### `summary`

| Field                                      | Suggested component                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `title`, `business_company_name`           | Hero card / page header (`title` as H1, company name as subtitle).                       |
| `status`                                   | Status badge with color-coded pill (DRAFT / PUBLISHED / IN_PROGRESS / DONE / CANCELLED). |
| `payment_type`                             | Pill next to the status — label: "Per task" or "Per month".                              |
| `created_at`, `updated_at`, `published_at` | Date metadata row under the title (`relative time` + tooltip with absolute timestamp).   |
| `project_cost`                             | Stat card (currency) — label: "Total project cost (pre-commission)".                     |

### `statistics`

| Field                                                                                  | Suggested component                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `total_tasks`, `completed_tasks`, `in_progress_tasks`                                  | 3 stat cards in a row + a horizontal progress bar `completed_tasks / total_tasks` showing % complete. |
| `total_project_members`                                                                | Stat card with avatar stack (cross-link with `team_members`).                                         |
| `total_applications`, `total_pending_applications`, `total_approved`, `total_rejected` | Donut chart "Applications by status" with center label = `total_applications`.                        |

### `task_statuses` (9 buckets)

- **Primary:** Stacked horizontal bar showing all 9 statuses with proportional widths.
- **Alternative:** Donut chart with one slice per status.
- **Optional secondary:** Funnel chart `draft → to_do → in_progress → in_review → done` for the "happy path".
- Use distinct colors for terminal states (`done` = green, `cancelled` = grey, `revision_requested` = amber).

### `team_members[]`

- Vertical list with avatar, full name, and an `active_status` pill.
- Click a row to drill into a member's task assignments (use `consultant_id`).
- If `team_members.length === 0`, render an empty state with a CTA to review pending applications.

### `application_breakdown`

| Field                                          | Suggested component                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pending`, `accepted`, `rejected`, `withdrawn` | Pie/donut chart "Application outcomes".                                                           |
| `approval_rate`                                | Gauge OR large percentage stat card. **Render `—` (em-dash) when `null`** (denominator was zero). |

### `recent_activity[]` (max 20, newest first)

- Vertical timeline / activity feed grouped by day.
- Icon per `event_type` (e.g., task created, application received, member joined).
- `actor.name` displayed as the subject; fall back to "System" when `actor.user_id` is `null`.
- `payload` is intentionally untyped — render a short, type-specific summary string per `event_type` rather than dumping JSON.
- "View all activity" link if more than 20 events are needed (would require a separate endpoint — not scoped here).

### Layout sketch

```
┌──────────── Hero (summary) ────────────┐
│  Title  Status pill   project_cost     │
│  Company · created · published          │
└─────────────────────────────────────────┘
┌── Stats (statistics) ─────────────────────────┐
│  total_tasks  done  in_progress  members      │
│  ▓▓▓▓▓▓▓░░░  completion %                     │
└──────────────────────────────────────────────┘
┌── Task statuses ──────┐ ┌── Applications ─────┐
│ stacked bar (9 buckets)│ │ donut + approval %  │
└────────────────────────┘ └─────────────────────┘
┌── Team members ───────┐ ┌── Recent activity ──┐
│ list with avatars      │ │ timeline (20)       │
└────────────────────────┘ └─────────────────────┘
```
