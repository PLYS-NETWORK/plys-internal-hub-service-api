# ConsultantProjectsController — API Specs

> **Source:** [src/modules/consultant-projects/controllers/projects.controller.ts](../../../src/modules/consultant-projects/controllers/projects.controller.ts)
> **Base path:** `/projects/consultant`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). The linked interface files contain the typed shape.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token (rejected by global `JwtAuthGuard`).                                                                                                                                                                                                                              |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller has no consultant profile — thrown by [ConsultantAccessService.resolveConsultantProfile](../../../src/modules/consultant-projects/services/consultant-access.service.ts).                                                                                                               |
| 404  | `PROJECT_NOT_FOUND`            | Project missing/soft-deleted, or not accessible to the caller (status not in `published \| in_progress` AND consultant is not an active member). Thrown by [ConsultantAccessService.resolveAccessibleProject](../../../src/modules/consultant-projects/services/consultant-access.service.ts). |
| 422  | (validation)                   | DTO shape failures (UUID, pagination bounds).                                                                                                                                                                                                                                                  |

## Endpoints

### 1. Discover projects matching consultant skills

- **Endpoint:** `GET /projects/consultant`
- **Method:** `GET`
- **Scope:** `@Roles(USER)`, `@Platform(CONSULTANT)`
- **Query params:** [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1 |
  | `limit` | `number` | no | default 20, max 100 |
- **Behaviour:**
  - Loads the caller's consultant profile via `RequestContextService.userId` (no `userId` parameter accepted).
  - Returns projects whose `status ∈ {published, in_progress}` AND that require at least one of the consultant's skills (intersection of `consultant_skills` × `project_required_skills`).
  - When the consultant has zero skills the page is short-circuited to empty (no projects table hit).
  - Each item carries availability/match metadata computed in a single SQL round-trip via grouped subqueries.

- **Response 200:** `PageDto<`[`IConsultantProjectListItemResponse`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-project-list-item.response.interface.ts)`>`

  Item shape:

  ```ts
  {
    id: string,
    title: string,
    company_name: string,                // from business_profiles.company_name
    is_available_to_apply: boolean,
    match_rate: number,                  // 0–100, integer (round((matched / required) * 100))
    is_platform_partner: boolean,        // business_profiles.is_partner_platform
    avg_price_per_task: number | null,   // null when payment_type = per_month
    payment_type: 'per_task' | 'per_month',
    is_applied: boolean                  // consultant has a PENDING or ACCEPTED application
  }
  ```

  Page meta: `{ page, take, item_count, page_count, has_previous_page, has_next_page }`.

  **`is_available_to_apply` formula:**
  `status ∈ {published, in_progress}` **AND** `active_member_count < required_consultants` **AND** `is_applied === false` **AND** `consultant_active_membership_count < MAX_CONCURRENT_PROJECTS` (provisional cap = 5; tracked in plan §10.1).

  **`avg_price_per_task`:** `AVG(tasks.price)` over tasks where `kanban_status NOT IN ('draft','cancelled')`. Null for `payment_type = per_month` because the price is at the project (monthly) level, not the task level.

- **Errors:** cross-cutting only.

---

### 2. Project detail

- **Endpoint:** `GET /projects/consultant/:id`
- **Method:** `GET`
- **Scope:** `@Roles(USER)`, `@Platform(CONSULTANT)`
- **Path params:** `id` (UUID v4)
- **Behaviour:**
  - Resolves via `ConsultantAccessService.resolveAccessibleProject` — succeeds if the project is in `published` / `in_progress`, OR if the caller has an `ACTIVE` `project_members` row.
  - `match_rate`, `is_need_interview`, and `is_available_to_apply` are computed against the caller's consultant profile.
- **Response 200:** [`IConsultantProjectDetailResponse`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-project-detail.response.interface.ts)

  ```ts
  {
    id: string,
    title: string,
    company_name: string,
    introduction: Record<string, unknown> | null,  // TipTap/ProseMirror JSON
    is_available_to_apply: boolean,
    match_rate: number,                            // 0–100
    payment_type: 'per_task' | 'per_month',
    is_need_interview: boolean                     // true ⇔ EXISTS project_interview_questions
  }
  ```

- **Errors:** cross-cutting only (404 `PROJECT_NOT_FOUND` if neither publicly accessible nor a member).

---

## FE rendering suggestions

### List view (`GET /projects/consultant`)

| Field                   | Suggested component                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `title`, `company_name` | Card header — title H2 + company subtitle. Click-through to detail view.                                                |
| `is_platform_partner`   | "Platform partner" badge (verified-style icon) when true; omit when false.                                              |
| `match_rate`            | Numeric badge with color ramp: green ≥75, amber 40–74, red <40. Tooltip explains the formula.                           |
| `payment_type`          | Pill: "Per task" or "Per month".                                                                                        |
| `avg_price_per_task`    | Stat shown only for `per_task` projects (currency). Hide row for `per_month` (value is null).                           |
| `is_available_to_apply` | Disable the "Apply" CTA when false; surface a tooltip ("Roster full" / "Already applied" / "Reached your project cap"). |
| `is_applied`            | Replace the CTA with a "Applied" status chip when true.                                                                 |

Empty state: when the consultant has no skills, render a CTA pointing to the profile/skills editor (the page comes back empty by design).

### Detail view (`GET /projects/consultant/:id`)

- Hero card: `title` + `company_name`, plus `payment_type` and `match_rate` pills.
- `introduction` — render the rich-text JSON via the project's TipTap viewer.
- `is_need_interview` — when true and the consultant chooses to apply, route them to the interview-answers form before submission.
- `is_available_to_apply` — primary CTA toggle (Apply / Disabled with tooltip).
