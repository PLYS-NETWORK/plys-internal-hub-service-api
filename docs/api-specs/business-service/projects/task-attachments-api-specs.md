# TaskAttachmentsController — API Specs

> **Source:** [apps/business-service/src/modules/business-projects/controllers/task-attachments.controller.ts](../../../../apps/business-service/src/modules/business-projects/controllers/task-attachments.controller.ts)
> **Base path:** `/api/v1/projects/business/:id/tasks/:taskId/attachments`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Caller timezone:** any `Date` field in a response is formatted via `@TimezoneDate` using the IANA zone supplied in the `x-timezone` request header (e.g. `Asia/Ho_Chi_Minh`). Falls back to `UTC` when the header is missing or unrecognised.
> **Two-step upload flow:** the client first uploads files via `POST /files`, then submits the returned `file_id`s to the endpoints below. The service snapshots metadata into `task_attachments` and flips the file's `purpose` to `task_attachment` so the orphan-cleanup cron does not reclaim it.

## Status gate

These endpoints are open while the task is in **DRAFT** or **TO_DO** kanban status:

- **DRAFT** — pre-payment; the business owner is composing the task in the backlog.
- **TO_DO** — paid, awaiting consultant pickup; references can still be curated.

Once the task moves to **IN_PROGRESS** (or any later status), the business surface is frozen for attachment edits and the endpoints return `422 TASK_INVALID_STATUS_TRANSITION`.

## Cross-cutting errors

| HTTP | error_code                                    | When                                             |
| ---- | --------------------------------------------- | ------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.                    |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile.           |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.                 |
| 404  | `TASK_NOT_FOUND`                              | Task missing or not in this project.             |
| 422  | `TASK_INVALID_STATUS_TRANSITION`              | Task is not DRAFT or TO_DO.                      |
| 422  | (validation)                                  | DTO shape failures (UUID, length, array bounds). |

## Endpoints

### 1. Attach previously-uploaded files

- **Endpoint:** `POST /projects/business/:id/tasks/:taskId/attachments`
- **Method:** `POST`
- **Headers:** `Idempotency-Key` (recommended) — see [shared/idempotency.md](../../api-gateway/idempotency-api-specs.md). Annotated by `@IdempotencyKey()`.
- **Path params:** `id` (UUID v4), `taskId` (UUID v4)
- **Request body:** [`AttachFilesDto`](../../../../apps/business-service/src/modules/business-projects/dto/requests/attach-files.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `file_ids` | `string[]` (UUID v4) | yes | size 1–20; unique; every entry must be owned by the caller |
- **Behaviour:**
  - Verifies the task exists, belongs to the project, and is in DRAFT or TO_DO. Otherwise raises `TASK_NOT_FOUND` (404) or `TASK_INVALID_STATUS_TRANSITION` (422).
  - Verifies every `file_id` is present, not soft-deleted, and `owner_user_id === caller.user_id` — otherwise rejects with `TASK_ATTACHMENT_FILE_NOT_OWNED` (400).
  - Inside one transaction: snapshots `{ file_name, file_url, mime_type, file_size_bytes }` into `task_attachments` (the `file_url` column is retained as an internal audit snapshot but is **not** exposed in the response — clients fetch bytes via `GET /files/:file_id/download`), then calls `files.markAsAttached(fileIds, FilePurpose.TASK_ATTACHMENT)`.
  - Storage URLs are resolved **outside** the transaction to keep storage-provider failures off long-lived locks.
  - **Cache:** the project's board cache is invalidated via `BoardCacheService.invalidateProject` only when the task is non-DRAFT (the board listing filters DRAFT out, so a DRAFT attach has nothing to invalidate).
- **Response 201:** [`ITaskAttachmentResponse[]`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/task-attachment.response.interface.ts)

  Item shape:

  ```ts
  {
    id: string,
    file_id: string | null,    // canonical files.id; use it to call GET /files/:file_id/download for bytes
    file_name: string,
    mime_type: string | null,
    file_size_bytes: number | null,
    uploaded_at: string         // formatted in caller tz
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 400 | `TASK_ATTACHMENT_FILE_NOT_OWNED` | Any supplied `file_id` is missing, soft-deleted, or owned by another user. |
  | 409 | `IDEMPOTENCY_KEY_BODY_MISMATCH` | `Idempotency-Key` reused with a different body. |

### 2. Rename an existing attachment

- **Endpoint:** `PATCH /projects/business/:id/tasks/:taskId/attachments/:attachmentId`
- **Method:** `PATCH`
- **Headers:** `Idempotency-Key` (recommended).
- **Path params:** `id` (UUID v4), `taskId` (UUID v4), `attachmentId` (UUID v4)
- **Request body:** [`UpdateTaskAttachmentDto`](../../../../apps/business-service/src/modules/business-projects/dto/requests/update-task-attachment.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `file_name` | `string` | yes | trimmed, 1–255 chars; display name only — the canonical storage key never changes |
- **Behaviour:** Only the display `file_name` is mutable. The `files` row, the storage object, and `mime_type` / `file_size_bytes` are immutable through this endpoint. Same status gate as `POST`. Cache invalidation rule is the same — DRAFT skips it.
- **Response 200:** [`ITaskAttachmentResponse`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/task-attachment.response.interface.ts) — same shape as create.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_ATTACHMENT_NOT_FOUND` | Attachment missing or doesn't belong to this task. |
  | 409 | `IDEMPOTENCY_KEY_BODY_MISMATCH` | `Idempotency-Key` reused with a different body. |

### 3. Delete an attachment

- **Endpoint:** `DELETE /projects/business/:id/tasks/:taskId/attachments/:attachmentId`
- **Method:** `DELETE`
- **Path params:** `id` (UUID v4), `taskId` (UUID v4), `attachmentId` (UUID v4)
- **Behaviour:** Soft-deletes the snapshot row (`task_attachments.deleted_at`) and calls `files.markAsOrphaned([file_id])` so the weekly orphan-cleanup cron can reclaim storage after `FILES_ORPHAN_GRACE_HOURS`. Atomic — single transaction. Status gate and cache rule match `POST`/`PATCH`.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_ATTACHMENT_NOT_FOUND` | Attachment missing or doesn't belong to this task. |

---

## Cross-links

- **Upstream upload:** the `file_id`s submitted here come from `POST /files` (Files module). Free uploads not attached within `FILES_ORPHAN_GRACE_HOURS` are reclaimed by the weekly cleanup cron.
- **Downstream read:** attachments surface on `GET /projects/business/:id/board/:taskId` via [`IBoardTaskDetailResponse.attachments`](../../../../apps/business-service/src/modules/business-projects/dto/responses/interfaces/board-task.response.interface.ts) once the task is on the board (TO_DO and beyond). On the backlog (DRAFT), the FE is expected to track newly-attached IDs locally between create and the next refresh — a dedicated draft-attachments read endpoint is not currently exposed.
- **Service:** [TaskAttachmentsService](../../../../apps/business-service/src/modules/business-projects/services/task-attachments.service.ts).
