# BoardController — API Specs

> **Source:** [src/modules/business-projects/controllers/board.controller.ts](../../../src/modules/business-projects/controllers/board.controller.ts)
> **Base path:** `/projects/business/:id/board`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).

## Cross-cutting errors

| HTTP | error_code                                    | When                                                           |
| ---- | --------------------------------------------- | -------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.                                  |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile.                         |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.                               |
| 422  | (validation)                                  | DTO shape failures (UUID, enum, integer bounds, array bounds). |

## Endpoints

### 1. List board tasks (Kanban)

- **Endpoint:** `GET /projects/business/:id/board`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Response 200:** [`IBoardTaskResponse[]`](../../../src/modules/business-projects/dto/responses/interfaces/board-task.response.interface.ts) — array of `{ id, title, price, difficulty_level, kanban_status, display_order, assignee: { consultant_id, full_name, avatar_url } | null, comments_count, evidences_count }`. Excludes DRAFT tasks.
- **Errors:** cross-cutting only.

### 2. Bulk-update kanban status & order (after drag)

- **Endpoint:** `PATCH /projects/business/:id/board/positions`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4)
- **Request body:** [`UpdateTaskPositionsDto`](../../../src/modules/business-projects/dto/requests/update-task-positions.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `tasks` | `TaskPositionItemDto[]` | yes | size 1–100 |
  | `tasks[].task_id` | `string` (UUID v4) | yes | |
  | `tasks[].kanban_status` | `TaskKanbanStatus` | yes | enum (target column) |
  | `tasks[].display_order` | `number` | yes | integer ≥ 0 |
- **Response 204:** empty body. Atomic — single transaction.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Not all task IDs belong to this project, any source task is DRAFT, or any target `kanban_status` is DRAFT. Thrown by [BoardService.updatePositions](../../../src/modules/business-projects/services/board.service.ts). |

### 3. Task detail

- **Endpoint:** `GET /projects/business/:id/board/:taskId`
- **Method:** `GET`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Response 200:** [`IBoardTaskDetailResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-task.response.interface.ts) — extends `IBoardTaskResponse` with `{ description, platform_fee_amount, consultant_payout, approved_by, approved_at, due_date, version, created_at, updated_at }`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT status (drafts are board-invisible). |

### 4. Assign task to a project member

- **Endpoint:** `POST /projects/business/:id/board/:taskId/assign`
- **Method:** `POST`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Request body:** [`AssignTaskDto`](../../../src/modules/business-projects/dto/requests/assign-task.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `consultant_id` | `string` (UUID v4) | yes | must be an active project member |
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task not in this project. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Task is DRAFT, CANCELLED, or DONE (not assignable). |
  | 422 | `TASK_CONSULTANT_NOT_PROJECT_MEMBER` | Consultant is not an active member of the project. |

### 5. Unassign task

- **Endpoint:** `POST /projects/business/:id/board/:taskId/unassign`
- **Method:** `POST`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Response 204:** empty body. Only allowed while task is in TO_DO or ASSIGNED.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task not in this project. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Task status is not TO_DO or ASSIGNED. |
