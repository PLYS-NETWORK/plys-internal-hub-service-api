# ConsultantExploreController — API Specs

> **Source:** [src/modules/consultant-projects/controllers/consultant-explore.controller.ts](../../../../src/modules/consultant-projects/controllers/consultant-explore.controller.ts)
> **Base path:** `/projects/consultant/explore`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by the global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`. No API key.
> **Intended caller:** authenticated consultants in the consultant SPA.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). Linked interface files contain the typed shape.

## Authentication

Standard JWT flow:

```
Authorization: Bearer <access_token>
```

- The global `JwtAuthGuard` verifies the token. Missing/invalid → 401 `AUTH_UNAUTHORIZED`.
- The global `RolesGuard` requires `UserRole.USER`. Anything else → 403.
- The global `PlatformGuard` requires `ActivePlatform.CONSULTANT` on the session. Mismatch → 403.
- The user must additionally have a `consultant_profiles` row (resolved via [ConsultantAccessService.resolveConsultantProfile](../../../../src/modules/consultant-projects/services/consultant-access.service.ts)). Missing → 403 `CONSULTANT_PROFILE_NOT_FOUND`.

## Rate limiting

Per-route limits enforced by the global `ThrottlerGuard` (registered in [AuthModule](../../../../src/modules/auth/auth.module.ts)) with Redis storage. Both routes use the shared [`THROTTLE_DISCOVERY`](../../../../src/common/constants/throttle.constants.ts) tier.

| Endpoint                               | Window | Limit  |
| -------------------------------------- | ------ | ------ |
| `GET /projects/consultant/explore`     | 60s    | 60 req |
| `GET /projects/consultant/explore/:id` | 60s    | 60 req |

When exceeded, the response is `429 Too Many Requests` (surfaced through the envelope as `error_code: AUTH_RATE_LIMITED` when the global filter normalises it).

## Caching

Responses are cached in Redis keyed on the **consultant**, locale, and request params. `match_rate` and `is_joined` are caller-specific, so cache keys MUST include `consultantId` — no two consultants share a cache slot. No explicit invalidation: short TTLs mean newly-published / status-changed projects roll over within ≤2 minutes.

| Endpoint                               | TTL  | Key shape                                                                          |
| -------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `GET /projects/consultant/explore`     | 60s  | `consultant_explore:list:<consultantId>:<lang>:<page>:<limit>:<status>:<title-lc>` |
| `GET /projects/consultant/explore/:id` | 120s | `consultant_explore:detail:<consultantId>:<lang>:<id>`                             |

Cache failures (Redis down/timeouts) are non-fatal — both reads and writes log a warning and the endpoint falls through to the database.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token (rejected by global `JwtAuthGuard`).                                                                                                                                                                                                             |
| 403  | (role/platform)                | Token belongs to a non-`USER` role or active platform ≠ `CONSULTANT`.                                                                                                                                                                                                         |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller is authenticated but has no `consultant_profiles` row — thrown by [ConsultantAccessService.resolveConsultantProfile](../../../../src/modules/consultant-projects/services/consultant-access.service.ts).                                                               |
| 404  | `PROJECT_NOT_FOUND`            | Detail endpoint only. Project missing/soft-deleted, OR has a non-accessible status AND the caller is not an `ACTIVE` member. Thrown by [ConsultantAccessService.resolveAccessibleProject](../../../../src/modules/consultant-projects/services/consultant-access.service.ts). |
| 422  | `GENERIC_VALIDATION_FAILED`    | Query/path DTO shape failures (UUID, pagination bounds, `title` > 100, unknown `status`).                                                                                                                                                                                     |
| 429  | `AUTH_RATE_LIMITED`            | Per-route throttler limit exceeded.                                                                                                                                                                                                                                           |

Locale resolution: the request's resolved locale (from `Accept-Language` via the i18n middleware) controls translation of skill labels and category names returned by the detail endpoint. Cache keys include `lang`, so `en` / `vi` / etc. are stored independently.

---

## Endpoints

### 1. List discoverable projects

- **Endpoint:** `GET /projects/consultant/explore`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Query params:** [`ListConsultantExploreProjectsDto`](../../../../src/modules/consultant-projects/dto/requests/list-consultant-explore-projects.dto.ts) extends [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts)

  | Field    | Type                           | Required | Notes                                                                                                                                                                                          |
  | -------- | ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `page`   | `number`                       | no       | Default `1`. Min `1`.                                                                                                                                                                          |
  | `limit`  | `number`                       | no       | Default `20`. Max `100`.                                                                                                                                                                       |
  | `title`  | `string`                       | no       | Case-insensitive substring match on `project.title`. Max length `100`.                                                                                                                         |
  | `status` | `'published' \| 'in_progress'` | no       | Narrow to a single status. Any other value (incl. `draft`, `cancelled`, `done`) is rejected with 422. Omit to return both. The repository hard-pins the allow-list regardless of caller input. |

- **Behaviour:**
  - Loads the caller's consultant profile via `RequestContextService.userId` (no `userId` parameter accepted).
  - Returns every project whose `status ∈ {published, in_progress}` and `deleted_at IS NULL`. **The skill-match prefilter is intentionally removed** — joined or not joined, every discoverable project surfaces regardless of skill overlap. A consultant with zero skills still sees the list (their `match_rate` is just `0`).
  - Ordering (deterministic):
    1. `business.is_partner_platform DESC` — partner-platform projects pinned to the top.
    2. `project.published_at DESC NULLS LAST`.
    3. `project.id ASC` — stable tiebreaker for pagination.
  - Aggregated fields are computed in a single round-trip via grouped queries (one query each for required-skill counts, matched-skill counts, avg-price, active member counts, the caller's joined-set, the caller's total active memberships).

- **Response 200:** `PageDto<`[`IConsultantExploreProjectListItemResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-explore-project-list-item.response.interface.ts)`>`

  Item shape:

  ```ts
  {
    id: string,                            // project uuid
    title: string,
    company_name: string,                  // business_profiles.company_name
    is_platform_partner: boolean,          // business_profiles.is_partner_platform
    is_joined: boolean,                    // caller has an ACTIVE project_members row
    is_available_to_apply: boolean,        // see formula below
    match_rate: number,                    // 0–100, integer; round((matched / required) * 100)
    avg_price_per_task: number | null,     // null when payment_type = per_month
    payment_type: 'per_task' | 'per_month',
    total_members: number,                 // COUNT(project_members WHERE status='active')
    required_consultants: number,          // smallint, 0 when not specified
    published_at: string | null            // ISO 8601, nullable
  }
  ```

  Page envelope: `{ data: Item[], meta: { page, limit, itemCount, pageCount, hasPreviousPage, hasNextPage } }`.

  **`match_rate` formula:** `Math.round((matchedCount / requiredCount) * 100)`, where `matchedCount` is the number of the project's required skills the caller owns (inner join `project_required_skills` × `consultant_skills` filtered to the caller). Yields `0` when `requiredCount === 0`.

  **`is_available_to_apply` formula** (provisional, applications removed — currently signals "still recruiting AND consultant has capacity"):
  `status ∈ {published, in_progress}` **AND** `total_members < required_consultants` **AND** `consultant_active_membership_count < MAX_CONCURRENT_PROJECTS` (provisional cap = 5 in code; will be replaced once a consultant-side capacity column lands).

  **`avg_price_per_task`:** `AVG(tasks.price)` over tasks excluding `kanban_status ∈ ('draft','cancelled')` (see [`TaskRepository.avgPriceByProjectIds`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts)). Forced to `null` when `payment_type = per_month` because the price is at the project (monthly) level, not the task level.

- **Errors:** cross-cutting only.

#### Example request

```http
GET /api/v1/projects/consultant/explore?page=1&limit=20&title=ai&status=published
Authorization: Bearer <access_token>
```

#### Example response (truncated)

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
        "company_name": "Acme Inc.",
        "is_platform_partner": true,
        "is_joined": false,
        "is_available_to_apply": true,
        "match_rate": 75,
        "avg_price_per_task": 80.0,
        "payment_type": "per_task",
        "total_members": 2,
        "required_consultants": 5,
        "published_at": "2026-05-10T08:42:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "itemCount": 47,
      "pageCount": 3,
      "hasPreviousPage": false,
      "hasNextPage": true
    }
  },
  "timestamp": "2026-05-16T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/explore"
}
```

---

### 2. Project detail

- **Endpoint:** `GET /projects/consultant/explore/:id`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Path params:** `id` — UUID v4 (`ParseUUIDPipe({ version: '4' })`). Bad UUID → 422.
- **Behaviour:**
  - Resolves via [`ConsultantAccessService.resolveAccessibleProject`](../../../../src/modules/consultant-projects/services/consultant-access.service.ts) — succeeds if the project is `published` / `in_progress`, **OR** the caller has an `ACTIVE` row in `project_members`. So a consultant retains access to projects they joined even after the status moves to `done` or `cancelled`.
  - Loads the project's full required-skill list with each `Skill` populated; labels are translated against `src/i18n/<lang>/skill.json` and `src/i18n/<lang>/category.json` (fallback to the i18n key when no translation exists).
  - Cached per `(consultantId, lang, id)` for 120s.

- **Response 200:** [`IConsultantExploreProjectDetailResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-explore-project-detail.response.interface.ts)

  ```ts
  {
    id: string,
    title: string,
    company_name: string,
    is_platform_partner: boolean,
    is_joined: boolean,
    is_available_to_apply: boolean,
    match_rate: number,                                  // 0–100
    avg_price_per_task: number | null,                   // null for per_month
    payment_type: 'per_task' | 'per_month',
    total_members: number,                               // COUNT(project_members WHERE status='active')
    required_consultants: number,
    published_at: string | null,                         // ISO 8601, nullable
    started_at: string | null,                           // ISO 8601, nullable
    completed_at: string | null,                         // ISO 8601, nullable
    status: 'draft' | 'configured' | 'published' | 'in_progress' | 'done' | 'cancelled',
    introduction: Record<string, unknown> | null,        // TipTap / ProseMirror JSON
    required_skills: Array<{
      id: string,
      name: string,                                      // i18n key, e.g. "skill_react"
      label: string,                                     // translated label, e.g. "React"
      category: string | null,                           // i18n key
      category_label: string | null                      // translated category label
    }>
  }
  ```

  > `status` widens to the full project-status enum because joined members keep access after the project leaves the public-discovery set. Non-members can only ever see `published` / `in_progress` here.

- **Errors:**

  | HTTP | error_code          | When                                                                                                            |
  | ---- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
  | 404  | `PROJECT_NOT_FOUND` | Project does not exist, is soft-deleted, has a non-accessible status, AND the caller is not an `ACTIVE` member. |

---

## Sensitive fields — deliberately NOT exposed

The DTOs use `@Exclude()` at the class level + explicit `@Expose()` per field, so the following entity columns are **invisible to consultant callers** even if loaded by the query:

- `BusinessProfile`: `user_id`, `tax_id`, `address_line`, `state_province`, `postal_code`, `phone_number`, `account_balance`, `stripe_connect_account_id`, `commission_rate`, `allow_payment_credit`, `is_verified`, all audit columns.
- `Project`: `business_id`, `code`, `cancelled_at`, all audit columns.
- `Task`: only the aggregated `avg_price_per_task` value escapes; row-level task data is not exposed.

If a new sensitive column is later added to one of these entities, the `@Exclude()`-by-default policy means it stays hidden until someone explicitly adds `@Expose()` to the DTO.

---

## FE rendering suggestions

### List view (`GET /projects/consultant/explore`)

| Field                                    | Suggested component                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`, `company_name`                  | Card header — title H2 + company subtitle. Click-through to detail view.                                                                                                 |
| `is_platform_partner`                    | "Platform partner" verified badge when true; combine with the pinned ordering for a visual hierarchy.                                                                    |
| `is_joined`                              | "Joined" pill / membership indicator. When `true`, the apply CTA should be replaced by an "Open project" action.                                                         |
| `match_rate`                             | Numeric badge with color ramp: green ≥75, amber 40–74, red <40. Tooltip explains the formula ("Share of the project's required skills you've certified").                |
| `payment_type`                           | Pill: "Per task" or "Per month".                                                                                                                                         |
| `avg_price_per_task`                     | Stat shown only for `per_task` projects (currency). Hide the row for `per_month` (value is null).                                                                        |
| `total_members` / `required_consultants` | "N of M joined" progress chip indicating roster fill.                                                                                                                    |
| `is_available_to_apply`                  | Disable the "Apply" CTA when false; surface a tooltip ("Roster full" / "Reached your project cap"). When `is_joined === true`, prefer the "Open project" action instead. |
| `published_at`                           | Relative timestamp ("2 days ago"). Hide when `null` (shouldn't happen for accessible-status projects but be defensive).                                                  |

Sort/filter UI: there is no sort-by query param; the partner-pinned ordering is server-decided. The status filter is a 2-value toggle ("Recruiting" → `published`, "In progress" → `in_progress`, "All" → omit). The title filter is a free-text input (debounce ≥ 250 ms; backend cache key uses the lowercased value).

### Detail view (`GET /projects/consultant/explore/:id`)

- Hero card: `title`, `company_name`, `is_platform_partner` badge, `payment_type` and `match_rate` pills.
- Body: render `introduction` via the project's TipTap viewer (`Record<string, unknown> | null`).
- Skills section: list `required_skills` as chips using `label` (group by `category_label` when consistent).
- Timeline strip: `published_at` → `started_at` → `completed_at` with the current `status` highlighted.
- Roster strip: `total_members` / `required_consultants`.
- Primary CTA:
  - `is_joined === true` → "Open project board" (when overview/board endpoints come back online in later steps).
  - `is_joined === false && is_available_to_apply === true` → "Request to join".
  - `is_joined === false && is_available_to_apply === false` → disabled CTA with tooltip ("Roster full" / "You've reached your project cap").

### Empty / error states

- Empty list → "No projects match your filters" with a CTA to clear filters. A blanket empty page (no filters set) shouldn't happen unless the platform genuinely has no published projects.
- 404 from detail → "This project is no longer available" page. Do not reveal whether the project existed and was cancelled vs. never existed.
- 429 → exponential backoff with a soft toast ("You're moving fast — try again in a moment.").
- 403 `CONSULTANT_PROFILE_NOT_FOUND` → redirect to the onboarding completion flow.
