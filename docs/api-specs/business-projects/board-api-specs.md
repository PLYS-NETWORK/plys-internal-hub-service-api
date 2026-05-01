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
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Not all task IDs belong to this project, any source task is DRAFT, or any target `kanban_status` is DRAFT. Thrown by [BoardService.updatePositions](../../../src/modules/business-projects/services/board/board.service.ts). |

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

---

## Comments

> **Service:** [BoardCommentsService](../../../src/modules/business-projects/services/board/board-comments.service.ts)
> **Storage cleanup model:** detached / deleted attachments soft-delete the underlying `files` row. The actual storage object is reclaimed by the daily 03:00 UTC purge cron after `FILES_PURGE_AFTER_DAYS` — the `file_url` may still resolve briefly after the API returns 204.
> Common path: `:taskId` must belong to the project and must NOT be in DRAFT (drafts have no board surface).

### 6. Create a task comment

- **Endpoint:** `POST /projects/business/:id/board/:taskId/comments`
- **Method:** `POST`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Request body:** [`CreateBoardCommentDto`](../../../src/modules/business-projects/dto/requests/create-board-comment.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `comment` | `Record<string, unknown>` | yes | rich-text JSON document (TipTap/ProseMirror); must not be empty |
  | `file_ids` | `string[]` (UUID v4) | no | 0–10 caller-owned file ids; persisted as snapshotted attachments |
- **Response 201:** [`IBoardCommentResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-comment.response.interface.ts) — `{ id, task_id, author: { user_id, name, avatar_url }, comment, is_edited, edited_at, created_at, attachments: [{ id, file_id, file_name, file_url, mime_type, file_size_bytes, uploaded_at }] }`. `author` resolves from the caller's `business_profiles` row (`company_name` + `logo_url`). `attachments` is `[]` when none.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT. |
  | 400 | `TASK_COMMENT_FILE_NOT_OWNED` | Any supplied `file_id` is missing, soft-deleted, or owned by a different user. |

### 7. Update own task comment

- **Endpoint:** `PATCH /projects/business/:id/board/:taskId/comments/:commentId`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4), `commentId` (UUID v4)
- **Request body:** [`UpdateBoardCommentDto`](../../../src/modules/business-projects/dto/requests/update-board-comment.dto.ts) — at least one field required
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `comment` | `Record<string, unknown>` | no | when present, flips `is_edited=true` and stamps `edited_at=now()` |
  | `file_ids` | `string[]` (UUID v4) | no | full replacement; `[]` detaches all; omitted leaves attachments untouched. Detached files are soft-deleted (storage purged on next cron) |
- **Response 200:** [`IBoardCommentResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-comment.response.interface.ts) — same shape as create.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT. |
  | 404 | `TASK_COMMENT_NOT_FOUND` | Comment missing, soft-deleted, or doesn't belong to this task. |
  | 403 | `TASK_COMMENT_FORBIDDEN` | Caller is not the comment's author. |
  | 400 | `TASK_COMMENT_EMPTY_UPDATE` | Neither `comment` nor `file_ids` was supplied. |
  | 400 | `TASK_COMMENT_FILE_NOT_OWNED` | Any supplied `file_id` is missing, soft-deleted, or owned by another user. |

### 8. Delete own task comment

- **Endpoint:** `DELETE /projects/business/:id/board/:taskId/comments/:commentId`
- **Method:** `DELETE`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4), `commentId` (UUID v4)
- **Response 204:** empty body. Soft-deletes the comment (`is_deleted=true`), hard-deletes its `task_comment_attachments` rows, and soft-deletes the underlying `files` rows so the daily purge cron reclaims storage.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT. |
  | 404 | `TASK_COMMENT_NOT_FOUND` | Comment missing or already soft-deleted. |
  | 403 | `TASK_COMMENT_FORBIDDEN` | Caller is not the comment's author. |

---

## Task History

> **Service:** [BoardHistoryService](../../../src/modules/business-projects/services/board/board-history.service.ts)
> Rows are append-only, populated by DB trigger `trg_log_task_change`. Filters to `change_type IN (STATUS_CHANGE, ASSIGNMENT, UNASSIGNMENT)`.

### 9. List task history

- **Endpoint:** `GET /projects/business/:id/board/:taskId/history`
- **Method:** `GET`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Query params:** [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1, ≥ 1 |
  | `limit` | `number` | no | default 20, max 100 |
- **Response 200:** `PageDto<`[`IBoardTaskHistoryResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-task-history.response.interface.ts)`>` — items: `{ id, task_id, change_type, previous_kanban_status, new_kanban_status, previous_assignee: { consultant_id, full_name, avatar_url } | null, new_assignee: { consultant_id, full_name, avatar_url } | null, author: { user_id, name, avatar_url }, note, changed_at }`. `author.name` resolution order: `consultant_profiles.full_name` → `business_profiles.company_name` → `users.email` → `"System"` (when `changed_by IS NULL`). Avatar prefers `consultant_profiles.avatar_url`, falls back to `business_profiles.logo_url`. Ordered `changed_at DESC`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT. |

---

## Evidences

> **Service:** [BoardEvidencesService](../../../src/modules/business-projects/services/board/board-evidences.service.ts)
> Read-only on the BUSINESS surface. Mutations live on the consultant routes via the existing `TaskEvidencesService`.

### 10. List task evidences

- **Endpoint:** `GET /projects/business/:id/board/:taskId/evidences`
- **Method:** `GET`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Query params:** [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1, ≥ 1 |
  | `limit` | `number` | no | default 20, max 100 |
- **Response 200:** `PageDto<`[`IBoardEvidenceResponse`](../../../src/modules/business-projects/dto/responses/interfaces/board-evidence.response.interface.ts)`>` — items: `{ id, task_id, author: { consultant_id, full_name, avatar_url }, remarks, is_edited, edited_at, created_at, attachments: [{ id, file_id, file_name, file_url, mime_type, file_size_bytes, uploaded_at }] }`. Excludes soft-deleted evidences. Ordered `created_at DESC`.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing or in DRAFT. |

---

## Background: orphan-file cleanup

Not an endpoint — a daily 03:00 UTC sweep ([FilesCleanupService.purgeOrphanedUploads](../../../src/modules/files/files-cleanup.service.ts)) soft-deletes any `files` row that is `purpose IS NULL`, has no row in `task_comment_attachments` / `task_evidence_attachments`, and is older than `FILES_ORPHAN_GRACE_HOURS` (default 24h). The byte object is then reclaimed by the existing `purgeExpiredSoftDeletes` pass after `FILES_PURGE_AFTER_DAYS`. FE/integration impact: an upload via `POST /files` that's never attached will eventually disappear; clients should reuse `file_id`s within ~24h of upload.
