# BusinessProjectsController — API Specs

> **Source:** [src/modules/business-projects/controllers/projects.controller.ts](../../../src/modules/business-projects/controllers/projects.controller.ts)
> **Base path:** `/projects/business`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). The linked interface files contain the typed shape.

## Cross-cutting errors (apply to all endpoints unless stated otherwise)

| HTTP | error_code                                    | When                                                                                                                                                                                                             |
| ---- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token (rejected by global `JwtAuthGuard`).                                                                                                                                                |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile — thrown by [BusinessAccessService.resolveBusinessProfile](../../../src/modules/business-projects/services/business-access.service.ts).                                    |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller — thrown by [BusinessAccessService.resolveOwnedProject](../../../src/modules/business-projects/services/business-access.service.ts). Applies to every endpoint that takes `:id`. |
| 422  | (validation)                                  | DTO shape failures from `class-validator` (missing/invalid fields, UUID, length, enum).                                                                                                                          |

## Endpoints

### 1. Create draft project

- **Endpoint:** `POST /projects/business`
- **Method:** `POST`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Request body:** [`ICreateProjectRequest`](../../../src/modules/business-projects/dto/requests/interfaces/create-project.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `title` | `string` | yes | |
  | `introduction` | `Record<string, unknown> \| null` | no | rich-text JSON |
- **Response 201:** [`IProjectSummaryResponse`](../../../src/modules/business-projects/dto/responses/interfaces/project-summary.response.interface.ts) — `{ id, title, introduction, status, required_consultants, published_at, created_at, updated_at }`
- **Errors:** cross-cutting only.

### 2. List own projects

- **Endpoint:** `GET /projects/business`
- **Method:** `GET`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Query params:** [`ListProjectsDto`](../../../src/modules/business-projects/dto/requests/list-projects.dto.ts) (extends `PageOptionsDto`)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1 |
  | `take` | `number` | no | default 20, max 100 |
  | `keywords` | `string` | no | length 2–200, trimmed |
- **Response 200:** `PageDto<`[`IProjectListItemResponse`](../../../src/modules/business-projects/dto/responses/interfaces/project-list-item.response.interface.ts)`>` — items: `{ id, title, status, created_at, published_at, required_consultants, total_tasks, total_active_members, total_pending_applications }`. Meta: `{ page, take, item_count, page_count, has_previous_page, has_next_page }`.
- **Errors:** cross-cutting only.

### 3. Pre-flight publish validation

- **Endpoint:** `GET /projects/business/:id/publish-validation`
- **Method:** `GET`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Path params:** `id` (UUID v4)
- **Response 200:** [`IPublishValidationResponse`](../../../src/modules/business-projects/dto/responses/interfaces/publish-validation.response.interface.ts) — `{ can_publish, reason_code, account_balance, project_title, project_amount, commission_rate, commission_amount, total_amount, payment_type }`. Read-only — never throws on a publishable problem; it surfaces `can_publish=false` with a `reason_code`.
- **Errors:** cross-cutting only.

### 4. Publish project (atomic, charges payment)

- **Endpoint:** `PATCH /projects/business/:id/publish`
- **Method:** `PATCH`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Path params:** `id` (UUID v4)
- **Response 204:** empty body
- **Errors (delegated to legacy `ProjectsService`):**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project not in a publishable state (e.g., already PUBLISHED, CANCELLED). |
  | 422 | `PROJECT_INSUFFICIENT_BALANCE` | Pre-paid balance below `total_amount`. |
  | 422 | `PROJECT_CANNOT_PUBLISH` | Validation rules in [PublishValidationService](../../../src/modules/projects) blocked publishing (no tasks, missing skills, etc.). |
