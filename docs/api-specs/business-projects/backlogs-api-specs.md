# BacklogsController — API Specs

> **Source:** [src/modules/business-projects/controllers/backlogs.controller.ts](../../../src/modules/business-projects/controllers/backlogs.controller.ts)
> **Base path:** `/projects/business/:id/backlogs`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).

## Cross-cutting errors

| HTTP | error_code                                    | When                                             |
| ---- | --------------------------------------------- | ------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.                    |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile.           |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.                 |
| 422  | (validation)                                  | DTO shape failures (UUID, length, array bounds). |

## Endpoints

### 1. Create a draft task

- **Endpoint:** `POST /projects/business/:id/backlogs`
- **Method:** `POST`
- **Path params:** `id` (UUID v4)
- **Request body:** [`ICreateDraftTaskRequest`](../../../src/modules/business-projects/dto/requests/interfaces/create-draft-task.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `title` | `string` | yes | |
  | `description` | `Record<string, unknown> \| null` | no | rich-text JSON |
  | `price` | `string` | yes | decimal-safe string |
  | `difficulty_level` | `TaskDifficulty` | no | enum |
- **Response 201:** [`IDraftTaskResponse`](../../../src/modules/business-projects/dto/responses/interfaces/draft-task.response.interface.ts) — `{ id, title, description, price, platform_fee_amount, consultant_payout, difficulty_level, created_at, updated_at }`
- **Side effect — auto status transition:** after the task is inserted, [ProjectStatusService.recomputeAutoStatus](../../../src/modules/business-projects/services/projects/project-status.service.ts) runs in the same transaction and re-evaluates the project's status against the completeness signals (`drafts > 0`, `required_skills > 0`, `required_consultants > 0`). Forward chain in one pass:
  - From `draft` with no skills / no consultants → `setting_up`.
  - From `draft` (or `setting_up`) when skills + `required_consultants > 0` are already set → `configured`.
  - No-op when the project is past the setup phase (`published_at IS NOT NULL`, or status is one of `published / in_progress / done / cancelled`).
- **Errors:** cross-cutting only.

### 2. List draft tasks

- **Endpoint:** `GET /projects/business/:id/backlogs`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Query params:** [`ListDraftTasksDto`](../../../src/modules/business-projects/dto/requests/list-draft-tasks.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1 |
  | `take` | `number` | no | default 20, max 100 |
  | `keywords` | `string` | no | length 2–200, trimmed; matches title |
- **Response 200:** `PageDto<`[`IDraftTaskResponse`](../../../src/modules/business-projects/dto/responses/interfaces/draft-task.response.interface.ts)`>` (items + standard pagination meta).
- **Errors:** cross-cutting only.

### 3. Update a draft task

- **Endpoint:** `PATCH /projects/business/:id/backlogs/:taskId`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Request body:** [`IUpdateDraftTaskRequest`](../../../src/modules/business-projects/dto/requests/interfaces/update-draft-task.request.interface.ts) — all fields optional
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `title` | `string` | no | length 3–300 |
  | `description` | `Record<string, unknown> \| null` | no | rich-text JSON; `null` clears it |
  | `price` | `string` | no | decimal-safe string |
  | `difficulty_level` | `TaskDifficulty` | no | enum |
- **Response 200:** [`IDraftTaskResponse`](../../../src/modules/business-projects/dto/responses/interfaces/draft-task.response.interface.ts)
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task does not exist, belongs to a different project, or is not DRAFT. |

### 5. Bulk-delete drafts (atomic)

- **Endpoint:** `DELETE /projects/business/:id/backlogs`
- **Method:** `DELETE`
- **Path params:** `id` (UUID v4)
- **Request body:** [`TaskIdsDto`](../../../src/modules/business-projects/dto/requests/task-ids.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `task_ids` | `string[]` (UUID v4) | yes | size 1–50 |
- **Response 204:** empty body.
- **Side effect — auto status transition:** after the delete, [ProjectStatusService.recomputeAutoStatus](../../../src/modules/business-projects/services/projects/project-status.service.ts) runs in the same transaction and demotes the project if completeness drops:
  - Removing the last draft on a setup-phase project → `draft`.
  - From `configured` if the deletes leave drafts but skills / consultants stay set → status stays `configured`; only when drafts hit zero does it drop further.
  - No-op when the project has been published (`published_at IS NOT NULL`).
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Any supplied task is not DRAFT, or count mismatch (some IDs not in this project). Thrown by [BacklogsService](../../../src/modules/business-projects/services/backlogs.service.ts). |

### 6. Validate move drafts → board (no charge, no state change)

- **Endpoint:** `POST /projects/business/:id/backlogs/add-to-board`
- **Method:** `POST`
- **Path params:** `id` (UUID v4)
- **Request body:** [`TaskIdsDto`](../../../src/modules/business-projects/dto/requests/task-ids.dto.ts) — same shape as endpoint 3.
- **Response 200:** [`IAddToBoardValidationResponse`](../../../src/modules/business-projects/dto/responses/interfaces/add-to-board-validation.response.interface.ts) — `{ is_valid, reason_code, moved_task_ids, project_amount, commission_rate, commission_amount, total_amount, payment_type, account_balance }`
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project status is not PUBLISHED or IN_PROGRESS. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Any supplied task is not DRAFT or count mismatch. |

### 7. Pay & promote drafts → TO_DO (atomic)

- **Endpoint:** `POST /projects/business/:id/backlogs/pay-tasks`
- **Method:** `POST`
- **Path params:** `id` (UUID v4)
- **Request body:** [`TaskIdsDto`](../../../src/modules/business-projects/dto/requests/task-ids.dto.ts)
- **Response 200:** [`IPayTasksResponse`](../../../src/modules/business-projects/dto/responses/interfaces/pay-tasks.response.interface.ts) — `{ moved_task_ids, project_amount, commission_rate, commission_amount, total_amount, payment_type, transaction_id }`
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 403 | `BUSINESS_PROFILE_NOT_FOUND` | Profile vanished / ownership mismatch inside the transaction lock. |
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project is not PUBLISHED or IN_PROGRESS. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Any supplied task is not DRAFT or count mismatch. |
  | 422 | `PROJECT_INSUFFICIENT_BALANCE` | Pre-paid balance below `total_amount`. |
