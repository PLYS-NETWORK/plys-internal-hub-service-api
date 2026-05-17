# ConsultantJoinedProjectsController — API Specs

> **Source:** [src/modules/consultant-projects/controllers/consultant-joined-projects.controller.ts](../../../../src/modules/consultant-projects/controllers/consultant-joined-projects.controller.ts)
> **Base paths:** `/projects/consultant/workspaces`, `/projects/consultant/joined`, `/projects/consultant/joined/:projectId`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by the global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`. No API key.
> **Intended caller:** authenticated consultants in the consultant SPA.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). Linked interface files contain the typed shape.

## Authentication

Standard JWT flow — identical to the [Membership controller](membership-api-specs.md):

```
Authorization: Bearer <access_token>
```

- Global `JwtAuthGuard` verifies the token. Missing/invalid → 401 `AUTH_UNAUTHORIZED`.
- Global `RolesGuard` requires `UserRole.USER`. Anything else → 403.
- Global `PlatformGuard` requires `ActivePlatform.CONSULTANT` on the session. Mismatch → 403.
- The user must additionally have a `consultant_profiles` row (resolved via [ConsultantAccessService.resolveConsultantProfile](../../../../src/modules/consultant-projects/services/consultant-access.service.ts)). Missing → 403 `CONSULTANT_PROFILE_NOT_FOUND`.

## Membership gating

Unlike the explore endpoints — which surface projects in `PUBLISHED` / `IN_PROGRESS` to any consultant — these endpoints require the caller to be an **`ACTIVE` member** of the project. Implementation lives in [`ConsultantAccessService.resolveJoinedProject`](../../../../src/modules/consultant-projects/services/consultant-access.service.ts):

- Loads the caller's `project_members` row for that project.
- If it doesn't exist or `status ≠ ACTIVE` → 404 `PROJECT_NOT_FOUND` (deliberately 404 not 403, to avoid leaking project existence to non-members).
- If membership is `LEFT` or `REMOVED` → 404 `PROJECT_NOT_FOUND` (same path).

The list endpoints (`/workspaces`, `/joined`) filter via an `INNER JOIN project_members` on `status='active'` — they never return non-member rows in the first place.

## Rate limiting

All three routes use the shared [`THROTTLE_DISCOVERY`](../../../../src/common/constants/throttle.constants.ts) tier — these are reads, surfaced on every workspace navigation.

| Endpoint                                     | Window | Limit  |
| -------------------------------------------- | ------ | ------ |
| `GET /projects/consultant/workspaces`        | 60s    | 60 req |
| `GET /projects/consultant/joined`            | 60s    | 60 req |
| `GET /projects/consultant/joined/:projectId` | 60s    | 60 req |

When exceeded, the response is `429 Too Many Requests` (surfaced through the envelope as `error_code: AUTH_RATE_LIMITED`).

## Caching

Responses are cached in Redis keyed on the **consultant** and request params. Cache keys MUST include `consultantId` — no two consultants share a slot. Writes from the [Tasks controller](tasks-api-specs.md) and the [Membership controller](membership-api-specs.md) invalidate these keys on success so freshly-joined projects / status flips appear immediately.

| Endpoint                                     | TTL  | Key shape                                                               |
| -------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `GET /projects/consultant/workspaces`        | 60s  | `consultant_workspaces:list:<consultantId>:<page>:<limit>:<keyword-lc>` |
| `GET /projects/consultant/joined`            | 60s  | `consultant_joined:list:<consultantId>:<page>:<limit>:<keyword-lc>`     |
| `GET /projects/consultant/joined/:projectId` | 120s | `consultant_joined:detail:<consultantId>:<projectId>`                   |

Cache failures (Redis down/timeouts) are non-fatal — both reads and writes log a warning and the endpoint falls through to the database.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                                                                                                                                                                                                                     |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token.                                                                                                                                                                                                                                            |
| 403  | (role/platform)                | Token belongs to a non-`USER` role or active platform ≠ `CONSULTANT`.                                                                                                                                                                                                    |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Authenticated user has no `consultant_profiles` row.                                                                                                                                                                                                                     |
| 404  | `PROJECT_NOT_FOUND`            | Detail endpoint only. Caller has no `ACTIVE` `project_members` row for the project, OR the project is missing/soft-deleted. Thrown by [ConsultantAccessService.resolveJoinedProject](../../../../src/modules/consultant-projects/services/consultant-access.service.ts). |
| 422  | `GENERIC_VALIDATION_FAILED`    | Query/path DTO shape failures (bad UUID, pagination bounds, `keyword` > 100 chars).                                                                                                                                                                                      |
| 429  | `AUTH_RATE_LIMITED`            | Per-route throttler limit exceeded.                                                                                                                                                                                                                                      |

---

## Endpoints

### 1. List workspaces (switcher)

Lightweight list designed for the workspace-switcher dropdown in the consultant SPA. Returns only id/title/code/status so it's fast on every navigation.

- **Endpoint:** `GET /projects/consultant/workspaces`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Cache:** 60s
- **Query params:** [`ListConsultantWorkspacesDto`](../../../../src/modules/consultant-projects/dto/requests/list-consultant-workspaces.dto.ts) extends [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts)

  | Field     | Type     | Required | Notes                                                                                    |
  | --------- | -------- | -------- | ---------------------------------------------------------------------------------------- |
  | `page`    | `number` | no       | Default `1`. Min `1`.                                                                    |
  | `limit`   | `number` | no       | Default `20`. Max `100`.                                                                 |
  | `keyword` | `string` | no       | Case-insensitive substring match on `project.title` OR `project.code`. Max length `100`. |

- **Behaviour:**
  - Resolves the caller's consultant profile via `RequestContextService.userId`.
  - Returns every project where the caller has `project_members.status = 'active'` AND `project.deleted_at IS NULL`. LEFT / REMOVED memberships are excluded.
  - Ordering: `project.title ASC`, then `project.id ASC` (stable cross-page tiebreak). Alphabetical fits a switcher's UX.
  - Lightweight projection — only `id`, `code`, `title`, `status` selected from the DB. No business join, no skill/task aggregates.

- **Response 200:** `PageDto<`[`IConsultantWorkspaceListItemResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-workspace-list-item.response.interface.ts)`>`

  Item shape:

  ```ts
  {
    id: string,            // project uuid
    title: string,
    code: string,          // e.g. "AI-1"
    status: 'published' | 'in_progress' | 'done' | 'cancelled'
  }
  ```

  Note: `draft` and `configured` statuses cannot appear in practice — a consultant can't have an `ACTIVE` membership on a pre-publication project.

#### Example request

```http
GET /api/v1/projects/consultant/workspaces?page=1&limit=10&keyword=ai
Authorization: Bearer <access_token>
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "AI-powered customer support automation",
        "code": "AI-1",
        "status": "in_progress"
      },
      {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "title": "AI demand forecasting",
        "code": "AI-2",
        "status": "published"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "itemCount": 2,
      "pageCount": 1,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  },
  "timestamp": "2026-05-17T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/workspaces"
}
```

---

### 2. List joined projects with progress

Full list with the per-project completion percentage and the caller's task counters — for the consultant's "My projects" dashboard.

- **Endpoint:** `GET /projects/consultant/joined`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Cache:** 60s
- **Query params:** [`ListConsultantJoinedProjectsDto`](../../../../src/modules/consultant-projects/dto/requests/list-consultant-joined-projects.dto.ts) extends `PageOptionsDto`. Same shape as workspaces (`page`, `limit`, `keyword`).

- **Behaviour:**
  - Resolves the caller's consultant profile.
  - Returns every project where caller has `ACTIVE` membership (LEFT/REMOVED excluded), eagerly joined with `business_profiles` to pull `company_name`.
  - Ordering: `pm.joined_at DESC` (newest joins first), then `project.id ASC` for stability.
  - Two aggregate queries run in parallel for the result set:
    1. [`TaskRepository.countCompletionByProjectIdsGroupedByProject`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) — `(total_tasks, completed_tasks)` per project. `completion_pct` = `round(completed / total * 100)` (or `0` when there are no tasks).
    2. [`TaskRepository.countCompletedByAssigneeAndProjectIds`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) — count of DONE tasks per project assigned to the caller.

- **Response 200:** `PageDto<`[`IConsultantJoinedProjectListItemResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-joined-project-list-item.response.interface.ts)`>`

  Item shape:

  ```ts
  {
    id: string,                            // project uuid
    title: string,
    code: string,
    status: 'published' | 'in_progress' | 'done' | 'cancelled',
    started_at: string | null,             // ISO 8601; project.started_at
    company_name: string,                  // business_profiles.company_name
    completion_pct: number,                // integer 0–100; 0 when no tasks
    completed_tasks_by_me: number          // COUNT(tasks WHERE assigned_to=consultantId AND kanban_status='done')
  }
  ```

#### Example request

```http
GET /api/v1/projects/consultant/joined?page=1&limit=10&keyword=automation
Authorization: Bearer <access_token>
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "AI-powered customer support automation",
        "code": "AI-1",
        "status": "in_progress",
        "started_at": "2026-04-20T00:00:00.000Z",
        "company_name": "Acme Inc.",
        "completion_pct": 60,
        "completed_tasks_by_me": 3
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "itemCount": 1,
      "pageCount": 1,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  },
  "timestamp": "2026-05-17T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined"
}
```

---

### 3. Joined project detail

Full detail page for a single joined project. Includes the required-skills list, overall completion counters, and the caller's personal task counters.

- **Endpoint:** `GET /projects/consultant/joined/:projectId`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Cache:** 120s
- **Path params:** `projectId` — UUID v4 (`ParseUUIDPipe({ version: '4' })`). Bad UUID → 422.

- **Behaviour:**
  - Resolves the caller's consultant profile and verifies `ACTIVE` membership via `resolveJoinedProject`. Non-member or missing project → 404 `PROJECT_NOT_FOUND`.
  - Five queries run in parallel:
    1. [`BusinessProfileRepository.findOne`](../../../../src/modules/unit-of-work/repositories/profiles/business-profile.repository.ts) — for `company_name`.
    2. [`ProjectRequiredSkillRepository.findWithSkillByProjectId`](../../../../src/modules/unit-of-work/repositories/projects/project-required-skill.repository.ts) — required skills with their `Skill` rows, translated into the request locale.
    3. [`TaskRepository.countByProjectIdsGroupedByStatus`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) — project-wide status histogram. `total_tasks` = sum of every non-DRAFT bucket. `completed_tasks_overall` = `done` bucket.
    4. [`TaskRepository.countByAssigneeAndProjectGroupedByStatus`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) — caller's own status histogram. `completed_tasks_by_me` = `done` bucket. `in_progress_by_me` = `in_progress` bucket.
    5. [`ProjectMemberRepository.countActiveTotalByProjectIds`](../../../../src/modules/unit-of-work/repositories/projects/project-member.repository.ts) — `total_members` (ACTIVE only).
  - `completion_pct` = `round(completed_tasks_overall / total_tasks * 100)`, or `0` when `total_tasks = 0`.

- **Response 200:** [`IConsultantJoinedProjectDetailResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-joined-project-detail.response.interface.ts)

  ```ts
  {
    id: string,
    title: string,
    code: string,
    status: 'published' | 'in_progress' | 'done' | 'cancelled',
    introduction: Record<string, unknown> | null,     // Tiptap doc; passthrough JSONB
    started_at: string | null,
    completed_at: string | null,
    company_name: string,
    required_skills: Array<{
      id: string,
      name: string,                                   // i18n key — e.g. "skill_react"
      label: string,                                  // localized label
      category: string | null,                        // i18n key
      category_label: string | null
    }>,
    total_members: number,                            // ACTIVE memberships
    total_tasks: number,                              // every non-DRAFT bucket
    completed_tasks_overall: number,                  // kanban_status='done'
    completion_pct: number,                           // 0–100
    completed_tasks_by_me: number,                    // caller's DONE count on this project
    in_progress_by_me: number                         // caller's IN_PROGRESS count on this project
  }
  ```

- **Errors (in addition to cross-cutting):**

  | HTTP | error_code          | When                                                                                                                          |
  | ---- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
  | 404  | `PROJECT_NOT_FOUND` | Caller has no `ACTIVE` membership on the project, OR project is missing/soft-deleted. (Deliberately 404 — no existence leak.) |

#### Example request

```http
GET /api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
Accept-Language: en
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "AI-powered customer support automation",
    "code": "AI-1",
    "status": "in_progress",
    "introduction": {
      "type": "doc",
      "content": [
        /* ... */
      ]
    },
    "started_at": "2026-04-20T00:00:00.000Z",
    "completed_at": null,
    "company_name": "Acme Inc.",
    "required_skills": [
      {
        "id": "...",
        "name": "skill_react",
        "label": "React",
        "category": "category_frontend",
        "category_label": "Frontend"
      }
    ],
    "total_members": 4,
    "total_tasks": 10,
    "completed_tasks_overall": 6,
    "completion_pct": 60,
    "completed_tasks_by_me": 3,
    "in_progress_by_me": 1
  },
  "timestamp": "2026-05-17T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000"
}
```

#### Example failure — not a member

```json
{
  "status_code": 404,
  "message": "Project not found.",
  "error_code": "PROJECT_NOT_FOUND",
  "data": null,
  "timestamp": "2026-05-17T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Cache invalidation matrix

These read endpoints don't issue writes — they're invalidated by writes elsewhere:

| Source write                                                        | Keys deleted                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /projects/consultant/membership/:projectId/apply` or `/leave` | `consultant_workspaces:list:<consultantId>:*`, `consultant_joined:list:<consultantId>:*`, `consultant_joined:detail:<consultantId>:<projectId>`, `consultant_joined:tasks:<consultantId>:<projectId>:*` |
| `POST /projects/consultant/joined/:projectId/tasks/:taskId/assign`  | Same prefixes for `(consultantId, projectId)`                                                                                                                                                           |
| `POST .../tasks/:taskId/unassign`                                   | Same                                                                                                                                                                                                    |
| `POST .../tasks/:taskId/submit-for-review`                          | Same                                                                                                                                                                                                    |

Redis failures during invalidation are non-fatal — the service logs a warn and the affected reads simply remain stale until the TTL expires.

---

## FE rendering suggestions

### Workspace switcher

- Render the `/workspaces` results as a dropdown keyed on `id`. The `status` field is informational — typically rendered as a small badge next to the title (`In progress`, `Done`, etc.).
- The endpoint is cached for 60s; client-side cache can be more aggressive since invalidation happens server-side on apply/leave.

### Joined projects dashboard

- `/joined` is the landing page card grid. `completion_pct` doubles as a progress bar fill; `completed_tasks_by_me` is the consultant's personal contribution badge.
- Empty state: no joined projects → CTA back to `/projects/consultant/explore`.

### Joined project detail

- `/joined/:projectId` is the project hero page. `in_progress_by_me` is a useful "what I'm working on" counter — surface it next to the overall completion.
- Required skills list mirrors the explore detail page — re-use the same component (same shape, including localized labels).

### Error handling

| HTTP | error_code                     | Suggested copy                                         |
| ---- | ------------------------------ | ------------------------------------------------------ |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | "Complete your consultant profile to access projects." |
| 404  | `PROJECT_NOT_FOUND`            | "Project not found." Redirect to `/joined`.            |
| 429  | `AUTH_RATE_LIMITED`            | Silent retry with backoff. UI rarely surfaces this.    |

---

## Sensitive fields — deliberately NOT exposed

- `business_id`, `business_profiles.*` (other than `company_name`) — irrelevant to the consultant; do not echo.
- `consultant_id` — redundant with the JWT identity.
- `project_members` audit fields (`joined_at`, `left_at`, `id`) — surfaced only by the membership controller.
- Project payment/financial fields (`payment_type`, `avg_price_per_task`, `required_consultants`) — those belong to the explore feed; the joined surface is for **task execution**, not selection.

---

## Out of scope (future steps)

- Per-status breakdowns of `completed_tasks_by_me` (e.g. "3 done, 1 in review, 1 in progress" as a single returned object) — currently split across two fields on the detail endpoint.
- An archive view of past memberships (`LEFT`, `REMOVED`) — explicitly excluded by the joined-membership filter.
- Inline notification badges on each project card.
