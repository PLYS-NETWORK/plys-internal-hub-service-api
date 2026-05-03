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
- **Behaviour:** Service checks `(business_id, code)` uniqueness with a pre-flight `findOne` against [BusinessProjectsService.createProject](../../../src/modules/business-projects/services/projects/projects.service.ts). The DB-level unique constraint `uq_projects_business_code` (added by [migration 20260501000002](../../../src/database/migrations/20260501000002-AddProjectAndTaskCodes.ts)) acts as a safety net for the race window between check and insert; in that case clients see the generic `DATABASE_UNIQUE_VIOLATION` (409). Server defaults: `status = draft`, `required_consultants = 0`, `payment_type = per_task`.
- **Response 201:** [`IProjectSummaryResponse`](../../../src/modules/business-projects/dto/responses/interfaces/project-summary.response.interface.ts) — `{ id, code, title, introduction, status, payment_type, required_consultants, published_at, created_at, updated_at }`. `payment_type` is `per_task | per_month` (defaults to `per_task`). `required_consultants` defaults to `0` for newly-created projects.
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

### 4. Publish project (atomic, charges payment, promotes drafts)

- **Endpoint:** `PATCH /projects/business/:id/publish`
- **Method:** `PATCH`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Path params:** `id` (UUID v4)
- **Pre-condition:** project status **must be** `configured` (publishability is computed from completeness signals upstream — see settings/backlogs auto-transitions).
- **Behaviour (atomic — single DB transaction):**
  1. Locks the business profile row (`SELECT … FOR UPDATE`).
  2. Re-evaluates eligibility (balance, status) against the locked snapshot. Bails with the corresponding error if it can no longer publish.
  3. **Pre-paid businesses** (`allow_payment_credit = false`): debits `account_balance` by `total_amount` (sum of task prices + commission) and inserts a `BusinessTransaction` row with `type = PROJECT_PUBLISHED, status = COMPLETED`. **Credit-based businesses** (`allow_payment_credit = true`): no wallet write — the project is billed on the monthly cycle.
  4. Locks `payment_type` on the project (`PER_TASK` for PRE_PAID, `PER_MONTH` for CREDIT) and stamps `published_at = now()`.
  5. Flips `project.status` to `published`.
  6. **Promotes every existing DRAFT task on the project to `to_do`**, ordered by their existing `display_order ASC`, so the board surfaces them immediately when the consultant side queries it. The publish fee already covers these tasks (their prices are part of `total_amount`), so no separate `task_added` transaction is created. Drafts added _after_ publish keep the existing flow — explicit `pay-tasks` charges and promotes them.
- **Response 204:** empty body. Email + push notification fire post-commit.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project not in a publishable state (e.g., already PUBLISHED, CANCELLED). |
  | 422 | `PROJECT_INSUFFICIENT_BALANCE` | Pre-paid balance below `total_amount`. |
  | 422 | `PROJECT_CANNOT_PUBLISH` | Validation rules in [ProjectPublishService.evaluatePublishEligibility](../../../src/modules/business-projects/services/projects/project-publish.service.ts) blocked publishing (status not `configured`, no tasks, missing skills, etc.). |

### 5. Soft-delete project (DRAFT / SETTING_UP / CONFIGURED only)

- **Endpoint:** `DELETE /projects/business/:id`
- **Method:** `DELETE`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Path params:** `id` (UUID v4)
- **Pre-condition:** project status **must be** one of `DRAFT`, `SETTING_UP`, or `CONFIGURED`. Anything from `PUBLISHED` onwards carries financial / member commitments and must go through the cancellation flow instead.
- **Behaviour:** [BusinessProjectsService.deleteProject](../../../src/modules/business-projects/services/projects/projects.service.ts) resolves ownership via [BusinessAccessService.resolveOwnedProject](../../../src/modules/business-projects/services/business-access.service.ts), asserts the status is in the deletable set, then calls `softDelete` on the project repository. `deleted_at` and `deleted_by` are stamped via `AuditSubscriber`. Child rows (tasks, interview questions, required skills) are **left in place** — their FKs declare `ON DELETE CASCADE` only at the row-delete layer, so a soft delete does not cascade. Existing read paths already filter out soft-deleted projects via `project.deleted_at IS NULL`, so the children become unreachable through the project surface.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_CANNOT_BE_DELETED` | Project status is past `CONFIGURED` (`PUBLISHED`, `IN_PROGRESS`, `DONE`, or `CANCELLED`). i18n: `error.project.cannot_be_deleted`. |

### 6. Re-publish project (revert PUBLISHED → CONFIGURED, refund all charges, reset tasks)

- **Endpoint:** `PATCH /projects/business/:id/re-publish`
- **Method:** `PATCH`
- **Scope:** `@Roles(USER)`, `@Platform(BUSINESS)`
- **Path params:** `id` (UUID v4)
- **Pre-condition:** project status **must be** `PUBLISHED`. Once any task is assigned the project auto-transitions to `IN_PROGRESS` (see [board endpoints](./board-api-specs.md) and consultant `assign-self`), and republish is rejected from there.
- **Behaviour (atomic — single DB transaction):**
  1. Locks the business profile row (`SELECT … FOR UPDATE`) — taken in every path so PRE_PAID and CREDIT flows share the same locking shape and concurrent task-payments cannot race the refund.
  2. **Publish-fee refund (PRE_PAID only — `allow_payment_credit = false`):**
     - Loads the latest completed `PROJECT_PUBLISHED` transaction for the project.
     - Credits `account_balance` by the original transaction's `amount`.
     - Inserts a `BusinessTransaction` row with `type = REFUND`, `status = COMPLETED`, `amount = total_amount = original.amount`, `project_id = :id`, `note = "Re-publish refund: <project title>"`.
  3. **Per-task refunds (every prior `task_added` transaction for this project):**
     - For each row with `status = COMPLETED` (PRE_PAID payment) → credits `account_balance` by `total_amount` and inserts a sibling `REFUND` row (`amount` / `total_amount` mirror the original; `note` references the original transaction number).
     - For each row with `status = PENDING` (CREDIT payment, not yet billed) → flips it to `status = REVERSED` (no money moves).
  4. **Task reset:** every task on the project whose `kanban_status != 'draft'` is moved back to `'draft'`; `display_order` is recomputed contiguously after the existing drafts. Tasks that were already `'draft'` (e.g. added after publish) keep their slot. Defensive 422 if any task has a non-null `assigned_to` (would mean `IN_PROGRESS` slipped through — should be unreachable).
  5. Flips `project.status` to `CONFIGURED`.
  6. Email + push notification fire **post-commit** so a delivery failure cannot roll back the wallet credit. The email body and the `refund_amount` notification metadata field both report the **total** refunded amount (publish fee + sum of task refunds). Email is skipped only when no money moved (e.g. CREDIT business with no PENDING task transactions).
- **Response 200:** `data: null`. Success message key `success.project.re_published`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project is not currently `PUBLISHED` — including the case where it has auto-progressed to `IN_PROGRESS` because a task was assigned. Also raised defensively if any task on the project still has `assigned_to != NULL` at republish time. |
  | 422 | `PROJECT_RECALL_TRANSACTION_NOT_FOUND` | Pre-paid business: no completed `PROJECT_PUBLISHED` transaction on file for the project, so the publish-fee refund amount cannot be determined. |
  | 403 | `BUSINESS_PROFILE_NOT_FOUND` | Defensive — the locked profile vanished mid-transaction. |
