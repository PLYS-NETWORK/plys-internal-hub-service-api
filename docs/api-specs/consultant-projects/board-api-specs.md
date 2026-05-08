# ConsultantBoardController — API Specs

> **Source:** [src/modules/consultant-projects/controllers/board.controller.ts](../../../src/modules/consultant-projects/controllers/board.controller.ts)
> **Base path:** `/projects/consultant/:id/board`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by the global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Membership:** every endpoint resolves the caller via `ConsultantAccessService.resolveProjectMembership`. The caller must be an `ACTIVE` member of `:id` (`project_members.status = 'active'`).
> **Cache invalidation:** every mutating endpoint here calls `BoardCacheService.invalidateProject` so the BUSINESS-side cached board (see [business-projects/board-api-specs.md](../business-projects/board-api-specs.md)) reflects the change on the next list call.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                              |
| ---- | ------------------------------ | --------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token.                                                     |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Caller has no consultant profile.                                                 |
| 404  | `PROJECT_NOT_FOUND`            | Project missing or soft-deleted.                                                  |
| 403  | `PROJECT_FORBIDDEN`            | Caller is not an `ACTIVE` member of the project.                                  |
| 404  | `TASK_NOT_FOUND`               | `:taskId` not found, soft-deleted, or in DRAFT (DRAFT lives in business backlog). |
| 422  | (validation)                   | DTO shape failures (UUID, attachment array bounds, missing rich-text body).       |

## Endpoints

### 1. List board tasks

- **Endpoint:** `GET /projects/consultant/:id/board`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Behaviour:**
  - Returns every non-DRAFT task in the project, ordered by `display_order ASC` then `id ASC`. Excludes soft-deleted rows.
  - Each row carries the assignee snapshot plus a live `results_count` via a correlated subquery on `task_results` (no N+1).
- **Response 200:** [`IConsultantBoardTaskResponse[]`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-board-task.response.interface.ts)

  Item shape:

  ```ts
  {
    id, code, title,
    kanban_status,        // TaskKanbanStatus (excludes DRAFT)
    display_order: number,
    assignee: { consultant_id, full_name, avatar_url } | null,
    results_count: number
  }
  ```

  The list is **not paginated** — boards are kept bounded (≤200 tasks per project per platform contract); render groupings in the FE.

- **Errors:** cross-cutting only.

---

### 2. Self-assign an unassigned `TO_DO` task

- **Endpoint:** `POST /projects/consultant/:id/board/:taskId/assign-self`
- **Method:** `POST`
- **Path params:** `id`, `taskId` (UUID v4)
- **Behaviour:**
  - Inside a transaction, takes a `pessimistic_write` lock on the task row, then asserts `assigned_to IS NULL` and `kanban_status = 'to_do'` before claiming. Concurrent calls serialise on the lock; the loser sees `TASK_ALREADY_ASSIGNED`.
  - Sets `assigned_to = consultant`, `assigned_at = now()`, `kanban_status = 'assigned'`.
  - **Side effect:** if the project is currently `published`, the assignment auto-promotes it to `in_progress` via [ProjectStatusService.promoteToInProgressIfPublished](../../../src/modules/business-projects/services/projects/project-status.service.ts) inside the same transaction. Once `in_progress`, the project can no longer be reverted to `configured`.
  - Wipes the BUSINESS-side board cache for the project.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | Task missing, soft-deleted, or not in this project. |
  | 409 | `TASK_ALREADY_ASSIGNED` | Another consultant claimed the task first. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Task is not in `TO_DO`. |

---

### 3. Release own assignment

- **Endpoint:** `POST /projects/consultant/:id/board/:taskId/unassign-self`
- **Method:** `POST`
- **Path params:** `id`, `taskId` (UUID v4)
- **Behaviour:** Transaction with `pessimistic_write` on the task. Allowed only when `assigned_to = caller AND kanban_status = 'assigned'` (i.e. before any work has started). Clears `assigned_to`, `assigned_at`, flips `assigned → to_do`. Wipes the BUSINESS-side board cache.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | `:taskId` does not belong to `:id` or is soft-deleted. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Caller is not the current assignee, or the task has progressed past `assigned`. |

---

### 4. Change task status (consultant-allowed transitions only)

- **Endpoint:** `PATCH /projects/consultant/:id/board/:taskId/status`
- **Method:** `PATCH`
- **Path params:** `id`, `taskId` (UUID v4)
- **Request body:** [`ChangeTaskStatusDto`](../../../src/modules/consultant-projects/dto/requests/change-task-status.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `kanban_status` | `TaskKanbanStatus` | yes | Target. Allowed transitions: `assigned → in_progress`, `in_progress → in_review`, `in_review → in_progress`. |
- **Behaviour:**
  - Transaction + `pessimistic_write`. Validates `task.assigned_to === caller` AND `(current, target)` is in the consultant transition map.
  - When `target = in_progress`, asserts the consultant has no other in-progress task (`existsInProgressByAssignee` excludes `:taskId`).
  - **Time tracking:** the **first time** a task enters `IN_PROGRESS`, the service stamps `tasks.started_at = now()`. On round-trips through `IN_REVIEW → IN_PROGRESS` the timestamp is preserved so `total_worked = completed_at − started_at` covers the whole task lifetime once both timestamps are populated. `tasks.completed_at` is owned by the future business-side approval flow (when transitioning into `DONE`).
  - Wipes the BUSINESS-side board cache.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | `:taskId` does not belong to `:id` or is soft-deleted. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Caller is not the assignee, or `(current, target)` is not in the allowed map (DONE/CANCELLED are business-only). |
  | 409 | `TASK_CONSULTANT_ALREADY_IN_PROGRESS` | Target is `in_progress` and the consultant already has another `in_progress` task. |

---

## Results (consultant-authored deliverables)

> **Service:** [ConsultantBoardResultsService](../../../src/modules/consultant-projects/services/board/board-results.service.ts)
> **Read counterpart:** [BoardResultsService.list](../../../src/modules/business-projects/services/board/board-results.service.ts) on the BUSINESS surface (`GET /projects/business/:id/board/:taskId/results`).
> Every mutation here wipes the BUSINESS-side board cache via `BoardCacheService.invalidateProject`.

### 5. Results — Create

- **Endpoint:** `POST /projects/consultant/:id/board/:taskId/results`
- **Method:** `POST`
- **Path params:** `id`, `taskId` (UUID v4)
- **Request body:** [`CreateBoardResultDto`](../../../src/modules/consultant-projects/dto/requests/create-board-result.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `remarks` | `Record<string, unknown>` | yes | Non-empty TipTap/ProseMirror JSON document. Opaque to the server. |
  | `file_ids` | `string[]` | no | Up to 10 UUID v4 IDs; each file must be owned by the caller. |
- **Permission:** caller **must** be the task's current `assigned_to` (consultant profile id).
- **Behaviour:**
  - Inside one transaction: insert the row into `task_results`, snapshot file metadata into `task_result_attachments`, and call `files.markAsAttached(fileIds, FilePurpose.TASK_RESULT)` so the orphan cleanup cron leaves them alone.
  - Storage URLs are resolved **outside** the transaction so storage-provider failures don't sit on long-lived locks.
  - Optimistic-locked via `@VersionColumn` on `task_results`.
- **Response 201:** [`IConsultantBoardResultResponse`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-board-result.response.interface.ts)

  ```ts
  {
    id, task_id,
    author: { user_id, consultant_id, full_name, avatar_url },
    remarks: Record<string, unknown>,
    is_edited: false,
    edited_at: null,
    created_at: Date,
    attachments: [
      { id, file_id, file_name, file_url, mime_type, file_size_bytes, uploaded_at }
    ]
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 403 | `TASK_RESULT_NOT_ASSIGNEE` | Caller is not the task's current assignee. |
  | 400 | `TASK_RESULT_FILE_NOT_OWNED` | One of `file_ids` is owned by another user, missing, or soft-deleted. |

---

### 6. Results — Update

- **Endpoint:** `PATCH /projects/consultant/:id/board/:taskId/results/:resultId`
- **Method:** `PATCH`
- **Path params:** `id`, `taskId`, `resultId` (UUID v4)
- **Request body:** [`UpdateBoardResultDto`](../../../src/modules/consultant-projects/dto/requests/update-board-result.dto.ts) — both fields optional, at least one required.
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `remarks` | `Record<string, unknown>` | no | When supplied, flips `is_edited=true` and stamps `edited_at=now()`. Must be non-empty when present. |
  | `file_ids` | `string[]` | no | Full replacement (see semantics below). Up to 10 UUID v4 IDs. |
- **Replace-semantics for `file_ids`:**
  - **Omitted** → attachments are left untouched.
  - **`[]`** → all current attachments are detached and their files orphaned for cleanup.
  - **Non-empty** → full replacement; new files are marked attached, files no longer in the set are orphaned.
- **Behaviour:** Caller must be the assignee AND the original author. `@VersionColumn` raises `OptimisticLockVersionMismatchError` (translates to a 409) on stale concurrent edits.
- **Response 200:** [`IConsultantBoardResultResponse`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-board-result.response.interface.ts) — same shape as create.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 400 | `TASK_RESULT_EMPTY_UPDATE` | Neither `remarks` nor `file_ids` supplied. |
  | 400 | `TASK_RESULT_FILE_NOT_OWNED` | One of `file_ids` is owned by another user. |
  | 404 | `TASK_RESULT_NOT_FOUND` | Result missing or soft-deleted. |
  | 403 | `TASK_RESULT_FORBIDDEN` | Caller is not the original author. |
  | 403 | `TASK_RESULT_NOT_ASSIGNEE` | Caller is no longer the task's assignee. |

---

### 7. Results — Delete

- **Endpoint:** `DELETE /projects/consultant/:id/board/:taskId/results/:resultId`
- **Method:** `DELETE`
- **Path params:** `id`, `taskId`, `resultId` (UUID v4)
- **Behaviour:** Soft-deletes the result (`is_deleted=true`), hard-deletes its `task_result_attachments` rows, and calls `files.markAsOrphaned(fileIds)` so the cleanup cron reclaims bytes after the grace window. All inside one transaction. Wipes the BUSINESS-side board cache.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_RESULT_NOT_FOUND` | Result missing or soft-deleted. |
  | 403 | `TASK_RESULT_FORBIDDEN` | Caller is not the original author. |
  | 403 | `TASK_RESULT_NOT_ASSIGNEE` | Caller is no longer the task's assignee. |

---

## FE rendering suggestions

### Board view

- 6 columns ordered: `to_do`, `assigned`, `in_progress`, `in_review`, `pending_approval` / `revision_requested` (collapsed under "Awaiting business"), `done` (`cancelled` shown only via filter toggle).
- Card body: `code` chip + `title`; `results_count` icon counter; assignee avatar pill (or "Unclaimed" placeholder).
- Disable drag-drop into DONE/CANCELLED — those statuses are business-only.
- Show a single-task-in-progress hint near the consultant's avatar when one already exists.

### Self-assign / unassign

- "Claim task" button on `to_do` unclaimed cards.
- "Release" button on `assigned` cards owned by the caller (hidden once the task moves past assigned).

### Status transitions

- `assigned → in_progress` button labelled "Start working" (greyed-out with tooltip when the consultant has another in-progress task). The first such transition stamps `tasks.started_at`, which the BUSINESS surface uses for `total_time_worked`.
- `in_progress → in_review` button labelled "Submit for review".
- `in_review → in_progress` link labelled "Reopen" (soft-revert when more work is needed before review is final).

### Results

- Use a single rich-text editor component (TipTap) writing directly to the `remarks` JSON column.
- Attach files via the existing file-upload pipeline; pass returned `file_id`s into `file_ids`.
- Render `is_edited` as a small "(edited)" caption with a tooltip showing `edited_at`.
- Only render the "New result" CTA when the caller is the task's current assignee.
