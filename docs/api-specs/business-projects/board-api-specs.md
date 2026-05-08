# BoardController — API Specs

> **Source:** [src/modules/business-projects/controllers/board.controller.ts](../../../src/modules/business-projects/controllers/board.controller.ts)
> **Base path:** `/projects/business/:id/board`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Caller timezone:** any `Date` field in a response is formatted via `@TimezoneDate` using the IANA zone supplied in the `x-timezone` request header (e.g. `Asia/Ho_Chi_Minh`). Falls back to `UTC` when the header is missing or unrecognised.

## Cross-cutting errors

| HTTP | error_code                                    | When                                                           |
| ---- | --------------------------------------------- | -------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.                                  |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile.                         |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.                               |
| 422  | (validation)                                  | DTO shape failures (UUID, enum, integer bounds, array bounds). |

## Endpoints

### 1. List board tasks (filtered, sorted, paginated, cached)

- **Endpoint:** `GET /projects/business/:id/board`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Query params:** [`ListBoardTasksDto`](../../../src/modules/business-projects/dto/requests/list-board-tasks.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `status` | `TaskKanbanStatus` | no | Optional kanban-status filter. `DRAFT` is server-rejected (drafts are board-invisible). |
  | `assignee_id` | `string` (UUID v4) or `"unassigned"` | no | Filter by `consultant_profiles.id`. The literal string `unassigned` returns only tasks with no assignee. |
  | `keywords` | `string` | no | Case-insensitive substring search against `title` and `code`. Min 2 chars, max 200 chars. Matched with `ILIKE '%…%'` on both columns (OR). |
  | `sort_by` | `"total_worked_hours" \| "created_at" \| "updated_at"` | no | Default `updated_at`. |
  | `order_by` | `"ASC" \| "DESC"` | no | Default `DESC`. |
  | `is_remove_cache` | `boolean` | no | When `true`, bypass the cached payload and refresh it. |
  | `page` | `number` | no | Default `1`, min `1`. |
  | `limit` | `number` | no | Default `20`, min `1`, max `100`. |
- **Behaviour:**
  - Returns non-`DRAFT` tasks in the project (`DONE` and `CANCELLED` are included; use `status` to narrow), paginated.
  - The `total_worked_hours` sort key is computed in SQL as `EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))`. NULLs sort last on `ASC`, first on `DESC`. A stable secondary sort on `id ASC` deduplicates ties.
  - `attachments_count` is a correlated subquery on the `task_attachments` table (no N+1).
  - **Caching:** the response is cached in Redis for ~60s, keyed per `(project, user, timezone, filter-set, page, limit)` via [BoardCacheService.buildKey](../../../src/modules/business-projects/services/board/board-cache.service.ts). `is_remove_cache=true` deletes the matching key and computes fresh. Any task / attachment / status mutation calls `BoardCacheService.invalidateProject(projectId)` and wipes every variant for the project.
- **Response 200:** `PageDto<`[`IBoardTaskResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-task.response.interface.ts)`>`

  ```ts
  {
    data: [
      {
        id: string,                                  // UUID
        code: string,                                // e.g. "WEB-1"
        title: string,
        description: Record<string, unknown> | null, // rich-text JSONB; opaque to server
        kanban_status: TaskKanbanStatus,
        price: string,                               // "500.00"
        assignee: { consultant_id, full_name, avatar_url } | null,
        total_time_worked: {
          days?: number,         // present only when total >= 24h
          hours: number,         // 0–23 when days set, else floor(total_seconds / 3600)
          total_seconds: number  // always present (sortable / recomputable)
        },
        attachments_count: number,
        last_update: string,                         // "YYYY-MM-DD HH:mm" in caller tz
        created_day: string                          // "YYYY-MM-DD" in caller tz
      }
    ],
    meta: {
      page: number,
      limit: number,
      itemCount: number,
      pageCount: number,
      hasPreviousPage: boolean,
      hasNextPage: boolean
    }
  }
  ```

- **Errors:** cross-cutting only.

### 2. Task detail (with attachments and time tracking)

- **Endpoint:** `GET /projects/business/:id/board/:taskId`
- **Method:** `GET`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Behaviour:** Fetches the task with assignee + attachments (ordered `uploaded_at ASC`). DRAFT tasks are surfaced as 404. Not cached — detail views are rarely repeated.
- **Response 200:** [`IBoardTaskDetailResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-task.response.interface.ts) — extends `IBoardTaskResponse` with:

  ```ts
  {
    platform_fee_amount: string,                  // "50.00"
    consultant_payout: string,                    // "450.00"
    approved_by: string | null,                   // user UUID
    approved_at: string | null,                   // formatted in caller tz
    due_date: string | null,                      // formatted in caller tz
    started_at: string | null,                    // formatted in caller tz
    completed_at: string | null,                  // formatted in caller tz
    version: number,
    attachments: [
      { id, file_id, file_name, file_url, mime_type, file_size_bytes, uploaded_at }
    ]
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT status (drafts are board-invisible). |

---

## Task History

> **Service:** [BoardHistoryService](../../../src/modules/business-projects/services/board/board-history.service.ts)
> Rows are append-only. Filters to `change_type IN (STATUS_CHANGE, ASSIGNMENT, UNASSIGNMENT)`.

### 3. List task history

- **Endpoint:** `GET /projects/business/:id/board/:taskId/history`
- **Method:** `GET`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Query params:** [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1, ≥ 1 |
  | `limit` | `number` | no | default 20, max 100 |
- **Response 200:** `PageDto<`[`IBoardTaskHistoryResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-task-history.response.interface.ts)`>`

  Item shape:

  ```ts
  {
    id, task_id,
    change_type,                                  // TaskHistoryChangeType
    previous_kanban_status: TaskKanbanStatus | null,
    new_kanban_status: TaskKanbanStatus | null,
    previous_assignee: { consultant_id, full_name, avatar_url } | null,
    new_assignee: { consultant_id, full_name, avatar_url } | null,
    author: { user_id, name, avatar_url },        // name fallback chain below
    note: string | null,
    changed_at: string                            // formatted in caller tz
  }
  ```

  `author.name` resolution: `consultant_profiles.full_name` → `business_profiles.company_name` → `users.email` → `"System"` (when `changed_by IS NULL`). Avatar prefers `consultant_profiles.avatar_url`, falls back to `business_profiles.logo_url`. Ordered `changed_at DESC, id DESC`.

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT. |

---

## Results (read-only on the BUSINESS surface)

> **Service:** [BoardResultsService](../../../src/modules/business-projects/services/board/board-results.service.ts)
> Mutations live on the consultant routes ([ConsultantBoardResultsService](../../../src/modules/consultant-projects/services/board/board-results.service.ts)).

### 4. List task results

- **Endpoint:** `GET /projects/business/:id/board/:taskId/results`
- **Method:** `GET`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Query params:** [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1, ≥ 1 |
  | `limit` | `number` | no | default 20, max 100 |
- **Behaviour:** Returns non-soft-deleted results for the task, ordered `created_at DESC, id DESC`. Each row's `attachments` are batch-loaded for the page slice in one follow-up query (no N+1).
- **Response 200:** `PageDto<`[`IBoardResultResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-result.response.interface.ts)`>`

  Item shape:

  ```ts
  {
    id, task_id,
    author: { consultant_id, full_name, avatar_url },
    remarks: Record<string, unknown>,             // opaque rich-text JSONB
    is_edited: boolean,
    edited_at: string | null,                     // formatted in caller tz
    created_at: string,                           // formatted in caller tz
    attachments: [
      { id, file_id, file_name, file_url, mime_type, file_size_bytes, uploaded_at }
    ]
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT. |

---

## Attachments (moved)

> Task-level attachments are no longer mounted under `/board/:taskId/attachments`. They were
> consolidated into the task-scoped controller at `/projects/business/:id/tasks/:taskId/attachments`,
> which works for both DRAFT and TO_DO tasks. See
> [task-attachments-api-specs.md](./task-attachments-api-specs.md) for the current contract.

---

## Milestones (task-count summary)

> **Service:** [BoardMilestonesService](../../../src/modules/business-projects/services/board/board-milestones.service.ts)
> DRAFT tasks and soft-deleted rows (`deleted_at IS NOT NULL`) are excluded from all counts.

### 8. Get task count summary by status

- **Endpoint:** `GET /projects/business/:id/board/milestones`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Query params:** [`GetMilestonesDto`](../../../src/modules/business-projects/dto/requests/get-milestones.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `is_remove_cache` | `boolean` | no | When `true`, bypass the cached payload and refresh it. |
- **Behaviour:**
  - Runs a single `SELECT kanban_status, COUNT(*)::int … GROUP BY kanban_status` query scoped to the project. No N+1.
  - All nine non-DRAFT statuses are always present in the response; statuses with zero tasks return `0` (not omitted).
  - **Caching:** result is cached in Redis for ~60s, keyed per `(project, user, timezone)` via [BoardCacheService.buildKey](../../../src/modules/business-projects/services/board/board-cache.service.ts) with digest `{ type: 'milestones' }`. `is_remove_cache=true` invalidates the key and recomputes. Any task or attachment mutation calls `BoardCacheService.invalidateProject(projectId)`, which wipes this key alongside all task-list page variants.
- **Response 200:** [`IBoardMilestonesResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-milestones.response.interface.ts)

  | Field                      | Maps to `TaskKanbanStatus` | Description                              |
  | -------------------------- | -------------------------- | ---------------------------------------- |
  | `total_tasks`              | —                          | Sum of all non-DRAFT, non-deleted tasks. |
  | `total_to_do`              | `to_do`                    | Published, not yet claimed.              |
  | `total_assigned`           | `assigned`                 | Claimed by a consultant, not started.    |
  | `total_in_progress`        | `in_progress`              | Consultant actively working.             |
  | `total_in_review`          | `in_review`                | Submitted, under review.                 |
  | `total_pending_approval`   | `pending_approval`         | Awaiting business approval.              |
  | `total_revision_requested` | `revision_requested`       | Sent back for rework.                    |
  | `total_done`               | `done`                     | Approved and complete.                   |
  | `total_cancelled`          | `cancelled`                | Cancelled at any stage.                  |

  ```ts
  {
    total_tasks: number,
    total_to_do: number,
    total_assigned: number,
    total_in_progress: number,
    total_in_review: number,
    total_pending_approval: number,
    total_revision_requested: number,
    total_done: number,
    total_cancelled: number
  }
  ```

- **Errors:** cross-cutting only (see top of document).

---

## Background: orphan-file cleanup

Not an endpoint — a weekly Mon 03:00 UTC sweep ([FilesCleanupService.purgeOrphanedUploads](../../../src/modules/files/files-cleanup.service.ts)) soft-deletes any `files` row that is `purpose IS NULL`, has no surviving row in `task_result_attachments` or `task_attachments`, and is older than `FILES_ORPHAN_GRACE_HOURS` (default 24h). The byte object is then reclaimed by the daily 03:00 UTC `purgeExpiredSoftDeletes` pass after `FILES_PURGE_AFTER_DAYS`. FE/integration impact: an upload via `POST /files/upload` that's never attached will eventually disappear; clients should attach `file_id`s within ~24h of upload.
