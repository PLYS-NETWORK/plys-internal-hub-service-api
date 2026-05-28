# BacklogsController — API Specs

> **Source:** [apps/business-service/src/modules/business-projects/controllers/backlogs.controller.ts](../../../../apps/business-service/src/modules/business-projects/controllers/backlogs.controller.ts)
> **Base path:** `/api/v1/projects/business/:id/backlogs`
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
- **Idempotency:** opt-in via `Idempotency-Key` request header (see [shared idempotency note](../../api-gateway/idempotency-api-specs.md)).
- **Path params:** `id` (UUID v4)
- **Request body:** [`ICreateDraftTaskRequest`](../../../../apps/business-service/src/modules/business-projects/dto/requests/interfaces/create-draft-task.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `title` | `string` | yes | length 3–300 |
  | `description` | `Record<string, unknown> \| null` | no | TipTap doc. JSON-encoded payload capped at 50 KB. |
  | `price` | `string` | yes | decimal-safe string |
- **Response 201:** [`IDraftTaskResponse`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/draft-task.response.interface.ts) — `{ id, code, title, description, price, platform_fee_amount, consultant_payout, creation_mode, created_at, updated_at }`. `creation_mode` is always `'manual'` for tasks created via this endpoint (the AI-sync batch endpoint stamps `'ai_assisted'`).
- **Side effects:**
  - **Auto status transition:** [ProjectStatusService.recomputeAutoStatus](../../../../apps/business-service/src/modules/business-projects/services/projects/project-status.service.ts) runs in the same transaction. Rule (single pass): `drafts === 0 ∨ consultants === 0 ∨ skills === 0 → draft`; else → `configured`. The intermediate `setting_up` state has been removed — projects flip directly between `draft` and `configured` based on completeness.
  - **AI context patch:** the new task is inserted into `project_ai_context.task_index` synchronously and `needs_reindex` flips to `true` so the FE re-derives summaries.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 409 | `IDEMPOTENCY_KEY_BODY_MISMATCH` | `Idempotency-Key` reused with a different body. |

### 2. List draft tasks

- **Endpoint:** `GET /projects/business/:id/backlogs`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Query params:** [`ListDraftTasksDto`](../../../../apps/business-service/src/modules/business-projects/dto/requests/list-draft-tasks.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1 |
  | `take` | `number` | no | default 20, max 100 |
  | `keywords` | `string` | no | length 2–200, trimmed; matches title |
- **Response 200:** `PageDto<`[`IDraftTaskResponse`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/draft-task.response.interface.ts)`>` (items + standard pagination meta). Each item carries `creation_mode` (`'manual'` or `'ai_assisted'`) so the FE can highlight AI-authored entries.
- **Errors:** cross-cutting only.

### 3. Update a draft task

- **Endpoint:** `PATCH /projects/business/:id/backlogs/:taskId`
- **Method:** `PATCH`
- **Idempotency:** opt-in via `Idempotency-Key` request header.
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Request body:** [`IUpdateDraftTaskRequest`](../../../../apps/business-service/src/modules/business-projects/dto/requests/interfaces/update-draft-task.request.interface.ts) — all fields optional
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `title` | `string` | no | length 3–300 |
  | `description` | `Record<string, unknown> \| null` | no | TipTap doc. JSON-encoded payload capped at 50 KB; `null` clears it. |
  | `price` | `string` | no | decimal-safe string |
- **Side effect — AI context patch:** the updated task is patched into `project_ai_context.task_index` in the same transaction. The existing FE-supplied `summary` is preserved; only structural fields (title, price, kanban_status) are refreshed.
- **Response 200:** [`IDraftTaskResponse`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/draft-task.response.interface.ts) — includes `creation_mode`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task does not exist, belongs to a different project, or is not DRAFT. |
  | 409 | `IDEMPOTENCY_KEY_BODY_MISMATCH` | `Idempotency-Key` reused with a different body. |

### 5. Bulk-delete drafts (atomic)

- **Endpoint:** `DELETE /projects/business/:id/backlogs`
- **Method:** `DELETE`
- **Idempotency:** opt-in via `Idempotency-Key` request header.
- **Path params:** `id` (UUID v4)
- **Request body:** [`TaskIdsDto`](../../../../apps/business-service/src/modules/business-projects/dto/requests/task-ids.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `task_ids` | `string[]` (UUID v4) | yes | size 1–50 |
- **Response 204:** empty body.
- **Side effects:**
  - **Auto status transition:** [ProjectStatusService.recomputeAutoStatus](../../../../apps/business-service/src/modules/business-projects/services/projects/project-status.service.ts) runs in the same transaction. Removing the last draft demotes the project to `draft`; otherwise stays `configured`. No-op when the project has been published.
  - **AI context patch:** the deleted tasks are removed from `task_index` and `needs_reindex` flips to `true` so the FE re-derives skill clusters / summaries.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Any supplied task is not DRAFT, or count mismatch (some IDs not in this project). Thrown by [BacklogsService](../../../../apps/business-service/src/modules/business-projects/services/backlogs.service.ts). |
  | 409 | `IDEMPOTENCY_KEY_BODY_MISMATCH` | `Idempotency-Key` reused with a different body. |

### 6. Validate move drafts → board (no charge, no state change)

- **Endpoint:** `POST /projects/business/:id/backlogs/add-to-board`
- **Method:** `POST`
- **Path params:** `id` (UUID v4)
- **Request body:** [`TaskIdsDto`](../../../../apps/business-service/src/modules/business-projects/dto/requests/task-ids.dto.ts) — same shape as endpoint 3.
- **Response 200:** [`IAddToBoardValidationResponse`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/add-to-board-validation.response.interface.ts) — `{ is_valid, reason_code, moved_task_ids, project_amount, commission_rate, commission_amount, total_amount, payment_type, account_balance }`
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project status is not PUBLISHED or IN_PROGRESS. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Any supplied task is not DRAFT or count mismatch. |

### 7. Pay & promote drafts → TO_DO (atomic)

- **Endpoint:** `POST /projects/business/:id/backlogs/pay-tasks`
- **Method:** `POST`
- **Path params:** `id` (UUID v4)
- **Request body:** [`TaskIdsDto`](../../../../apps/business-service/src/modules/business-projects/dto/requests/task-ids.dto.ts)
- **Response 200:** [`IPayTasksResponse`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/pay-tasks.response.interface.ts) — `{ moved_task_ids, project_amount, commission_rate, commission_amount, total_amount, payment_type, transaction_id }`
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 403 | `BUSINESS_PROFILE_NOT_FOUND` | Profile vanished / ownership mismatch inside the transaction lock. |
  | 422 | `PROJECT_INVALID_STATUS_TRANSITION` | Project is not PUBLISHED or IN_PROGRESS. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Any supplied task is not DRAFT or count mismatch. |
  | 422 | `PROJECT_INSUFFICIENT_BALANCE` | Pre-paid balance below `total_amount`. |
