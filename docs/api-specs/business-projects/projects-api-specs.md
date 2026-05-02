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
  | `code` | `string` | yes | Human-readable identifier, unique per business profile. Pattern `^[A-Z0-9]{2,8}$` (uppercase A-Z and 0-9, 2–8 chars). Used as the prefix for task codes (e.g. `WEB-1`). |
  | `title` | `string` | yes | length 3–300 |
  | `introduction` | `Record<string, unknown> \| null` | no | rich-text JSON (TipTap/ProseMirror) |
- **Behaviour:** Service checks `(business_id, code)` uniqueness with a pre-flight `findOne` against [BusinessProjectsService.createProject](../../../src/modules/business-projects/services/projects/projects.service.ts). The DB-level unique constraint `uq_projects_business_code` (added by [migration 20260501000002](../../../src/database/migrations/20260501000002-AddProjectAndTaskCodes.ts)) acts as a safety net for the race window between check and insert; in that case clients see the generic `DATABASE_UNIQUE_VIOLATION` (409).
- **Response 201:** [`IProjectSummaryResponse`](../../../src/modules/business-projects/dto/responses/interfaces/project-summary.response.interface.ts) — `{ id, code, title, introduction, status, payment_type, required_consultants, published_at, created_at, updated_at }`. `payment_type` is `per_task | per_month` (defaults to `per_task`).
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 409 | `PROJECT_CODE_ALREADY_EXISTS` | A project with the same `code` already exists for the calling business profile. |

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
- **Response 200:** `PageDto<`[`IProjectListItemResponse`](../../../src/modules/business-projects/dto/responses/interfaces/project-list-item.response.interface.ts)`>` — items: `{ id, code, title, status, payment_type, created_at, published_at, required_consultants, total_tasks, total_completed_tasks, total_active_members, total_pending_applications }`. `total_tasks` counts all non-soft-deleted tasks (DRAFT included); `total_completed_tasks` is the subset with `kanban_status = DONE`. `payment_type` is `per_task | per_month`. Meta: `{ page, take, item_count, page_count, has_previous_page, has_next_page }`.
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
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project not in a publishable state (e.g., already PUBLISHED, CANCELLED). |
  | 422 | `PROJECT_INSUFFICIENT_BALANCE` | Pre-paid balance below `total_amount`. |
  | 422 | `PROJECT_CANNOT_PUBLISH` | Validation rules in [PublishValidationService](../../../src/modules/projects) blocked publishing (no tasks, missing skills, etc.). |

### 5. Re-publish project (revert PUBLISHED → CONFIGURED, refund pre-paid)

- **Endpoint:** `PATCH /projects/business/:id/re-publish`
- **Method:** `PATCH`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Path params:** `id` (UUID v4)
- **Pre-condition:** project status **must be** `PUBLISHED`.
- **Behaviour:**
  - Flips status `PUBLISHED → CONFIGURED` so the business can edit settings before publishing again.
  - **Pre-paid businesses** (`business_profile.allow_payment_credit = false`):
    1. Locks the business profile row (`SELECT … FOR UPDATE`).
    2. Loads the latest completed `PROJECT_PUBLISHED` transaction for the project.
    3. Credits `account_balance` by the original transaction's `amount`.
    4. Inserts a `BusinessTransaction` row with `type = REFUND`, `status = COMPLETED`, `amount = total_amount = original.amount`, `project_id = :id`, `note = "Re-publish refund: <project title>"`.
    5. All four steps execute inside a single DB transaction; the lock prevents a concurrent task-payment from racing with the refund.
  - **Credit-based businesses** (`allow_payment_credit = true`): pure status flip — no wallet write, no refund row.
  - No member impact, no email.
- **Response 200:** `data: null`. Success message key `success.project.re_published`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project is not currently `PUBLISHED`. |
  | 422 | `PROJECT_RECALL_TRANSACTION_NOT_FOUND` | Pre-paid business: no completed `PROJECT_PUBLISHED` transaction on file for the project, so the refund amount cannot be determined. |
  | 403 | `BUSINESS_PROFILE_NOT_FOUND` | Defensive — the locked profile vanished mid-transaction. |
