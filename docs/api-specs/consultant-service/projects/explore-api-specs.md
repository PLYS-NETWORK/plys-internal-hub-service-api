# ExploreController — API Specs

> **Source:** [apps/consultant-service/src/modules/explore/explore.controller.ts](../../../apps/consultant-service/src/modules/explore/explore.controller.ts)
> **Base path:** `/api/v1/explore`
> **Scope (applies to every endpoint):** `@Public()` skips the global `JwtAuthGuard`; **controller-scoped** [`ExploreApiKeyGuard`](../../../apps/consultant-service/src/modules/explore/guards/explore-api-key.guard.ts) enforces a shared secret presented via the `x-api-key` header. No user identity is required or read.
> **Intended caller:** the Next.js BFF (Server Actions). End-users never hit these endpoints directly — the BFF holds the secret and proxies the response to the browser.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). Linked interface files contain the typed shape.

## Authentication

Every request **must** include the header:

```
x-api-key: <PUBLIC_ENDPOINT_API_KEY>
```

- The value is provisioned in the backend env (`PUBLIC_ENDPOINT_API_KEY`) and shared with the BFF out-of-band.
- The guard performs a length check then a `crypto.timingSafeEqual` to avoid timing-side-channel leaks.
- The header **must not** be exposed to browsers / client-side code. Use a Next.js Server Action (server-only) to attach it.

## Rate limiting

Per-route limits enforced by the global `ThrottlerGuard` with Redis storage (so limits survive across multiple API instances). Keys default to the caller IP — since every request comes from the BFF's egress IP, the limits apply to the BFF as a whole.

| Endpoint                    | Window | Limit   |
| --------------------------- | ------ | ------- |
| `GET /explore/skills`       | 60s    | 120 req |
| `GET /explore/projects`     | 60s    | 60 req  |
| `GET /explore/projects/:id` | 60s    | 60 req  |

When exceeded, the response is `429 Too Many Requests` (`error_code: AUTH_RATE_LIMITED` if surfaced through the envelope).

## Caching

Responses are cached in Redis keyed by `(locale, params)`. There is no explicit invalidation — short TTLs mean newly published / cancelled projects roll over within ≤2 minutes.

| Endpoint                    | TTL   | Key shape                                                                  |
| --------------------------- | ----- | -------------------------------------------------------------------------- |
| `GET /explore/skills`       | 3600s | `explore:skills:<lang>`                                                    |
| `GET /explore/projects`     | 60s   | `explore:projects:list:<lang>:<page>:<limit>:<status>:<skill_ids>:<title>` |
| `GET /explore/projects/:id` | 120s  | `explore:projects:detail:<lang>:<id>`                                      |

Cache failures (Redis down/timeouts) are non-fatal: the endpoint falls through to the database.

## Cross-cutting errors

| HTTP | error_code                      | When                                                                                        |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| 401  | `AUTH_TOKEN_INVALID`            | `x-api-key` header missing or does not match `PUBLIC_ENDPOINT_API_KEY` (constant-time cmp). |
| 422  | `GENERIC_VALIDATION_FAILED`     | Query DTO shape failures (UUID, pagination bounds, `skill_ids` > 20, `title` > 100).        |
| 429  | `AUTH_RATE_LIMITED`             | Per-route throttler limit exceeded for the caller IP.                                       |
| 500  | `GENERIC_INTERNAL_SERVER_ERROR` | Unexpected. Redis/DB failures that bubble past the cache guard.                             |

Locale resolution: the `Accept-Language` header (or whatever the project's i18n middleware sets) controls translation of skill labels and category names. Cache keys include `lang`, so `en` and `tr` are stored separately.

---

## Endpoints

### 1. List skills (filter dropdown)

- **Endpoint:** `GET /explore/skills`
- **Method:** `GET`
- **Throttle:** 120 req / 60s
- **Behaviour:**
  - Returns every row of the `skills` table, ordered by `name` ASC.
  - Each `name` is an i18n key (e.g. `skill_react`); `label` is the translated value resolved against `src/i18n/<lang>/skill.json`.
  - `category` follows the same pattern with `src/i18n/<lang>/category.json`. Skills without a category have both `category` and `category_label` set to `null`.
  - Cached for 1 hour per locale — these are static reference data.
- **Response 200:** [`IExploreSkillResponse[]`](../../../apps/consultant-service/src/modules/explore/dto/responses/interfaces/explore-skill.response.interface.ts)

  Item shape:

  ```ts
  {
    id: string,                   // uuid v4
    name: string,                 // i18n key, e.g. "skill_react"
    label: string,                // translated label, e.g. "React"
    category: string | null,      // i18n key, e.g. "category_frontend"
    category_label: string | null // translated category label, e.g. "Frontend"
  }
  ```

- **Errors:** cross-cutting only.

---

### 2. List explore projects

- **Endpoint:** `GET /explore/projects`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Query params:** [`ListExploreProjectsDto`](../../../apps/consultant-service/src/modules/explore/dto/requests/list-explore-projects.dto.ts) extends [`PageOptionsDto`](../../../packages/common-nest/dto/page-options.dto.ts)

  | Field       | Type                           | Required | Notes                                                                                                                                                                              |
  | ----------- | ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `page`      | `number`                       | no       | Default `1`. Min `1`.                                                                                                                                                              |
  | `limit`     | `number`                       | no       | Default `20`. Max `100`.                                                                                                                                                           |
  | `skill_ids` | `string` (CSV of UUIDv4)       | no       | Comma-separated. Max 20 entries. **ANY-match** semantics.                                                                                                                          |
  | `title`     | `string`                       | no       | Case-insensitive substring match. Max length 100.                                                                                                                                  |
  | `status`    | `'published' \| 'in_progress'` | no       | Narrow to a single status. Any other value (including `draft`, `cancelled`, `done`) is rejected with 422. Omit to return both. The repository hard-pins the allow-list either way. |

- **Behaviour:**
  - Returns projects whose `status ∈ {published, in_progress}` and `deleted_at IS NULL`. The status set is pinned in the repository; even a crafted request can never surface DRAFT / CANCELLED / DONE projects.
  - Filter logic:
    - `status`: when provided, narrows the list to that single status. Otherwise both `published` and `in_progress` are returned.
    - `skill_ids`: project is included if it requires **at least one** of the listed skills (subquery on `project_required_skills.skill_id IN (...)`).
    - `title`: `LOWER(project.title) LIKE LOWER('%<title>%')`.
  - Ordering (deterministic):
    1. `business.is_partner_platform DESC` — partner-platform projects pinned to the top.
    2. `project.published_at DESC` (NULLS LAST).
    3. `project.id ASC` — stable tiebreaker for pagination.
  - Cached per `(lang, page, limit, status, sorted-skill_ids, lowercased-title)` tuple for 60s.

- **Response 200:** [`PageDto<IExploreProjectListItemResponse>`](../../../apps/consultant-service/src/modules/explore/dto/responses/interfaces/explore-project-list-item.response.interface.ts)

  Item shape:

  ```ts
  {
    id: string,                          // project uuid
    title: string,
    company_name: string,                // business_profiles.company_name
    company_logo_url: string | null,     // business_profiles.logo_url
    is_partner_platform: boolean,        // business_profiles.is_partner_platform
    published_at: string | null,         // ISO 8601, nullable
    required_consultants: number,        // smallint, 0 when not specified
    total_members: number                // COUNT(project_members WHERE status='active')
  }
  ```

  Page envelope: `{ data: Item[], meta: { page, limit, itemCount, pageCount, hasPreviousPage, hasNextPage } }`.

- **Errors:** cross-cutting only.

#### Example request

```http
GET /api/v1/explore/projects?page=1&limit=20&skill_ids=b0b1...,c1c2...&title=ai
x-api-key: <secret>
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
        "company_logo_url": "https://cdn.example.com/logos/acme.png",
        "is_partner_platform": true,
        "published_at": "2026-05-10T08:42:00.000Z",
        "required_consultants": 3,
        "total_members": 2
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
  "path": "/api/v1/explore/projects"
}
```

---

### 3. Project detail

- **Endpoint:** `GET /explore/projects/:id`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Path params:** `id` — UUID v4 (`ParseUUIDPipe`). Bad UUID → 422.
- **Behaviour:**
  - Returns a single project whose `status ∈ {published, in_progress}` and `deleted_at IS NULL`.
  - Loads the project's full required-skill list with each `Skill` populated and translated into the request locale.
  - Cached per `(lang, id)` for 120s.

- **Response 200:** [`IExploreProjectDetailResponse`](../../../apps/consultant-service/src/modules/explore/dto/responses/interfaces/explore-project-detail.response.interface.ts)

  ```ts
  {
    id: string,
    title: string,
    company_name: string,
    company_logo_url: string | null,
    is_partner_platform: boolean,
    published_at: string | null,
    required_consultants: number,
    total_members: number,                        // COUNT(project_members WHERE status='active')
    introduction: Record<string, unknown> | null, // TipTap / ProseMirror JSON
    required_skills: IExploreSkillResponse[],     // see § 1 for shape
    started_at: string | null,                    // ISO 8601, nullable
    completed_at: string | null,                  // ISO 8601, nullable
    status: 'published' | 'in_progress'           // narrowed by the accessible-status filter
  }
  ```

- **Errors:**

  | HTTP | error_code          | When                                                                                                         |
  | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
  | 404  | `PROJECT_NOT_FOUND` | Project does not exist, is soft-deleted, or has a non-accessible status (e.g. `draft`, `cancelled`, `done`). |

---

## Sensitive fields — deliberately NOT exposed

The Explore DTOs use `@Exclude()` at the class level + explicit `@Expose()` per field, so the following entity columns are **invisible to public callers** even if loaded by the query:

- `BusinessProfile`: `user_id`, `tax_id`, `address_line`, `state_province`, `postal_code`, `phone_number`, `account_balance`, `stripe_connect_account_id`, `commission_rate`, `allow_payment_credit`, `is_verified`, all audit columns.
- `Project`: `business_id`, `code`, `payment_type` (intentionally omitted ahead of the upcoming refactor that removes payment-type logic), `cancelled_at`, all audit columns.
- `User`: never loaded; `email`, `password_hash`, role flags, exam state — none of these are reachable from the explore graph.

If a new sensitive column is later added to one of these entities, the `@Exclude()`-by-default policy means it stays hidden until someone explicitly adds `@Expose()` to the DTO.

---

## BFF / FE rendering suggestions

### Skills filter (`GET /explore/skills`)

| Field            | Suggested component                                                            |
| ---------------- | ------------------------------------------------------------------------------ |
| `label`          | Multi-select chip label.                                                       |
| `category_label` | Group skills by category in the dropdown; render category as a section header. |
| `name`           | Don't render — internal i18n key, not user-facing.                             |
| `id`             | Sent back in `skill_ids` when the user filters projects.                       |

### Project cards (`GET /explore/projects`)

| Field                   | Suggested component                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `title`, `company_name` | Card header — title H2 + company subtitle.                                                                               |
| `company_logo_url`      | Avatar/logo; show a fallback initial when `null`.                                                                        |
| `is_partner_platform`   | "Partner platform" verified badge when `true`. Combine with the pinned ordering for a visual hierarchy.                  |
| `published_at`          | Relative timestamp ("2 days ago"). Hide when `null` (shouldn't happen for accessible-status projects, but be defensive). |
| `required_consultants`  | "Looking for N consultants" stat. Hide when `0`.                                                                         |
| `total_members`         | "`total_members` / `required_consultants` joined" progress chip. Indicates roster fill.                                  |

### Project detail (`GET /explore/projects/:id`)

- Hero: `title`, `company_name`, `company_logo_url`, `is_partner_platform` badge.
- Body: render `introduction` via the same TipTap viewer the consultant flow uses (`Record<string, unknown> | null`).
- Skills section: list `required_skills` as chips using `label` (and group by `category_label` when consistent).
- Timeline strip: `published_at` → `started_at` → `completed_at` with the current `status` highlighted.

### Empty / error states

- 404 from detail → render a "this project is no longer available" page (do not leak whether the project existed and was cancelled vs. never existed).
- 429 → exponential backoff in the BFF; never surface raw to end users.
- 401 → operator alert: the BFF secret is rotated or missing.
