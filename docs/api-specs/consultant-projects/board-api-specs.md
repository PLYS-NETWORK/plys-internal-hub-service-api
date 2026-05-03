# ConsultantBoardController — API Specs

> **Source:** [src/modules/consultant-projects/controllers/board.controller.ts](../../../src/modules/consultant-projects/controllers/board.controller.ts)
> **Base path:** `/projects/consultant/:id/board`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Membership:** every endpoint resolves the caller via `ConsultantAccessService.resolveProjectMembership`. The caller must be an `ACTIVE` member of `:id` (`project_members.status = 'active'`).

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
  - Returns every non-DRAFT task in the project, ordered by `display_order ASC`. Excludes soft-deleted rows.
  - Each row carries the assignee snapshot plus live `comment_count` / `evidences_count` via correlated subqueries (no N+1).
- **Response 200:** [`IConsultantBoardTaskResponse[]`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-board-task.response.interface.ts)

  Item shape:

  ```ts
  {
    id, code, title,
    kanban_status,        // TaskKanbanStatus (excludes DRAFT)
    display_order: number,
    difficulty_level,     // TaskDifficulty
    assignee: { consultant_id, full_name, avatar_url } | null,
    comment_count: number,
    evidences_count: number
  }
  ```

  The list is **not paginated** — boards are kept bounded (≤200 tasks per project per platform contract); render groupings in the FE.

- **Errors:** cross-cutting only.

---

### 2. Self-assign an unassigned `TO_DO` task

- **Endpoint:** `POST /projects/consultant/:id/board/:taskId/assign-self`
- **Method:** `POST`
- **Path params:** `id`, `taskId` (UUID v4)
- **Behaviour:** Inside a transaction, takes a `pessimistic_write_or_fail` lock on the row matching `(taskId, project_id, kanban_status='to_do', assigned_to IS NULL, deleted_at IS NULL)`, then sets `assigned_to = consultant`, `assigned_at = now()`, `kanban_status = 'assigned'`. Concurrent calls on the same row fail the WHERE predicate cleanly — exactly one wins.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Task missing, in another status, already assigned, or soft-deleted. |

---

### 3. Release own assignment

- **Endpoint:** `POST /projects/consultant/:id/board/:taskId/unassign-self`
- **Method:** `POST`
- **Path params:** `id`, `taskId` (UUID v4)
- **Behaviour:** Transaction with `pessimistic_write` on the task. Allowed only when `assigned_to = caller AND kanban_status = 'assigned'` (i.e., before any work has started). Clears `assigned_to`, `assigned_at`, flips status `assigned → to_do`.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | `:taskId` does not belong to `:id` or is soft-deleted. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Caller is not the current assignee, or task is past `assigned`. |

---

### 4. Change task status (consultant-allowed transitions only)

- **Endpoint:** `PATCH /projects/consultant/:id/board/:taskId/status`
- **Method:** `PATCH`
- **Path params:** `id`, `taskId` (UUID v4)
- **Request body:** [`IChangeTaskStatusRequest`](../../../src/modules/consultant-projects/dto/requests/interfaces/change-task-status.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `kanban_status` | `TaskKanbanStatus` | yes | Target. Allowed transitions: `assigned → in_progress`, `in_progress → in_review`, `in_review → in_progress`. |
- **Behaviour:** Transaction + pessimistic_write. Validates `task.assigned_to === caller` AND `(current, target)` is in the consultant transition map. When `target = in_progress`, asserts the consultant has no other in-progress task (`existsInProgressByAssignee` excludes `:taskId`). Saves the new status.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_NOT_FOUND` | `:taskId` does not belong to `:id` or is soft-deleted. |
  | 422 | `TASK_INVALID_STATUS_TRANSITION` | Caller is not the assignee, or `(current, target)` is not in the allowed map (DONE/CANCELLED are business-only). |
  | 409 | `TASK_CONSULTANT_ALREADY_IN_PROGRESS` | Target is `in_progress` and the consultant already has another `in_progress` task. |

---

### 5. Comments — List

- **Endpoint:** `GET /projects/consultant/:id/board/:taskId/comments`
- **Method:** `GET`
- **Path params:** `id`, `taskId` (UUID v4)
- **Query params:** [`PageOptionsDto`](../../../src/common/dto/page-options.dto.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `page` | `number` | no | default 1, ≥ 1 |
  | `limit` | `number` | no | default 20, max 100 |
- **Behaviour:**
  - Returns non-deleted comments for the task (`is_deleted = false`), ordered `created_at DESC` with `id DESC` as the deterministic tiebreaker.
  - Author display is resolved in a single SQL via two left joins on `author_id` against `consultant_profiles` and `business_profiles` so business-authored comments render alongside consultant-authored ones.
  - `author.consultant_id` is **`null`** when the comment was authored by a business owner; populated when the author has a consultant profile.
  - Attachments are batch-loaded for the page slice in one follow-up query (no N+1).
- **Response 200:** `PageDto<`[`IConsultantBoardCommentResponse`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-board-comment.response.interface.ts)`>`

  ```ts
  {
    id, task_id,
    author: {
      user_id,
      consultant_id: string | null,   // null when authored by a business owner
      full_name,                      // consultant.full_name ?? business.company_name ?? ""
      avatar_url                      // consultant.avatar_url ?? business.logo_url ?? null
    },
    comment: Record<string, unknown>,
    is_edited: boolean,
    edited_at: Date | null,
    created_at: Date,
    attachments: [
      { id, file_id, file_name, file_url, mime_type, file_size_bytes, uploaded_at }
    ]
  }
  ```

- **Errors:** cross-cutting only.

---

### 6. Comments — Create

- **Endpoint:** `POST /projects/consultant/:id/board/:taskId/comments`
- **Method:** `POST`
- **Path params:** `id`, `taskId` (UUID v4)
- **Request body:** [`ICreateBoardCommentRequest`](../../../src/modules/consultant-projects/dto/requests/interfaces/create-board-comment.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `comment` | `Record<string, unknown>` | yes | Non-empty TipTap/ProseMirror JSON document. |
  | `file_ids` | `string[]` | no | Up to 10 UUID v4 IDs. Each file must be owned by the caller. |
- **Behaviour:**
  - Permission: any active project member can comment.
  - Inside a transaction: inserts the comment, snapshots attachment metadata into `task_comment_attachments`, and calls `files.markAsAttached(fileIds, FilePurpose.TASK_COMMENT)` to claim the canonical files.
  - Storage URLs are resolved **outside** the transaction — provider failures don't block on long-lived locks.
- **Response 201:** [`IConsultantBoardCommentResponse`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-board-comment.response.interface.ts)

  ```ts
  {
    id, task_id,
    author: { user_id, consultant_id, full_name, avatar_url },
    comment: Record<string, unknown>,
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
  | 400 | `TASK_COMMENT_FILE_NOT_OWNED` | One of `file_ids` is owned by a different user (or doesn't exist). |

---

### 7. Comments — Update

- **Endpoint:** `PATCH /projects/consultant/:id/board/:taskId/comments/:commentId`
- **Method:** `PATCH`
- **Path params:** `id`, `taskId`, `commentId` (UUID v4)
- **Request body:** [`IUpdateBoardCommentRequest`](../../../src/modules/consultant-projects/dto/requests/interfaces/update-board-comment.request.interface.ts) — both fields optional (at least one required).
- **Replace-semantics for `file_ids`:**
  - **Omitted** → attachments are left untouched.
  - **`[]`** → all current attachments are detached.
  - **Non-empty** → full replacement; attachments not in the new set have their `files.purpose` cleared (orphan cleanup cron reclaims bytes after the grace window).
- **Behaviour:** Service throws if neither field is supplied, asserts caller is the original author, then runs the comment-row save + attachment delta + `files.markAsAttached` / `markAsOrphaned` inside one transaction. When `comment` is supplied, `is_edited = true` and `edited_at = now()`.
- **Response 200:** Same shape as the create endpoint.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 400 | `TASK_COMMENT_EMPTY_UPDATE` | Neither `comment` nor `file_ids` supplied. |
  | 400 | `TASK_COMMENT_FILE_NOT_OWNED` | One of `file_ids` is owned by another user. |
  | 404 | `TASK_COMMENT_NOT_FOUND` | Comment missing or soft-deleted. |
  | 403 | `TASK_COMMENT_FORBIDDEN` | Caller is not the original author. |

---

### 8. Comments — Delete

- **Endpoint:** `DELETE /projects/consultant/:id/board/:taskId/comments/:commentId`
- **Method:** `DELETE`
- **Path params:** `id`, `taskId`, `commentId` (UUID v4)
- **Behaviour:** Soft-deletes the comment (`is_deleted = true`), hard-deletes the cheap attachment snapshot rows, calls `files.markAsOrphaned(fileIds)` so the cleanup cron reclaims bytes after the grace window. All inside one transaction.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_COMMENT_NOT_FOUND` | Comment missing or soft-deleted. |
  | 403 | `TASK_COMMENT_FORBIDDEN` | Caller is not the original author. |

---

### 9. Evidences — Create

- **Endpoint:** `POST /projects/consultant/:id/board/:taskId/evidences`
- **Method:** `POST`
- **Path params:** `id`, `taskId` (UUID v4)
- **Request body:** [`ICreateBoardEvidenceRequest`](../../../src/modules/consultant-projects/dto/requests/interfaces/create-board-evidence.request.interface.ts)
  | Field | Type | Required | Notes |
  |-------|------|----------|-------|
  | `remarks` | `Record<string, unknown>` | yes | Non-empty TipTap/ProseMirror JSON. |
  | `file_ids` | `string[]` | no | Up to 10 UUID v4 IDs; caller-owned. |
- **Permission:** caller **must** be the task's current `assigned_to`. Comments accept any member; evidence accepts only the assignee.
- **Behaviour:** Same transactional pattern as comments — insert + snapshot + `markAsAttached(FilePurpose.TASK_EVIDENCE)`. Optimistic-locked via `@VersionColumn` on `task_evidences`.
- **Response 201:** [`IConsultantBoardEvidenceResponse`](../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-board-evidence.response.interface.ts)

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
  | 403 | `TASK_EVIDENCE_NOT_ASSIGNEE` | Caller is not the task assignee. |
  | 400 | `TASK_EVIDENCE_FILE_NOT_OWNED` | One of `file_ids` is owned by another user. |

---

### 10. Evidences — Update

- **Endpoint:** `PATCH /projects/consultant/:id/board/:taskId/evidences/:evidenceId`
- **Method:** `PATCH`
- **Path params:** `id`, `taskId`, `evidenceId` (UUID v4)
- **Request body:** [`IUpdateBoardEvidenceRequest`](../../../src/modules/consultant-projects/dto/requests/interfaces/update-board-evidence.request.interface.ts) — both fields optional (at least one required). Same replace-semantics as comment updates.
- **Behaviour:** Caller must be the assignee AND the original author. `@VersionColumn` raises `OptimisticLockVersionMismatchError` (translates to a 409) on stale concurrent edits. When `remarks` is supplied, `is_edited = true` and `edited_at = now()`.
- **Response 200:** Same shape as the create endpoint.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 400 | `TASK_EVIDENCE_EMPTY_UPDATE` | Neither `remarks` nor `file_ids` supplied. |
  | 400 | `TASK_EVIDENCE_FILE_NOT_OWNED` | One of `file_ids` is owned by another user. |
  | 404 | `TASK_EVIDENCE_NOT_FOUND` | Evidence missing or soft-deleted. |
  | 403 | `TASK_EVIDENCE_FORBIDDEN` | Caller is not the original author. |
  | 403 | `TASK_EVIDENCE_NOT_ASSIGNEE` | Caller is no longer the task's assignee. |

---

### 11. Evidences — Delete

- **Endpoint:** `DELETE /projects/consultant/:id/board/:taskId/evidences/:evidenceId`
- **Method:** `DELETE`
- **Path params:** `id`, `taskId`, `evidenceId` (UUID v4)
- **Behaviour:** Same lifecycle as comment delete — soft-delete + attachment snapshot drop + `markAsOrphaned`.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `TASK_EVIDENCE_NOT_FOUND` | Evidence missing or soft-deleted. |
  | 403 | `TASK_EVIDENCE_FORBIDDEN` | Caller is not the original author. |
  | 403 | `TASK_EVIDENCE_NOT_ASSIGNEE` | Caller is no longer the task's assignee. |

---

## FE rendering suggestions

### Board view

- 6 columns ordered: `to_do`, `assigned`, `in_progress`, `in_review`, `pending_approval` / `revision_requested` (collapsed under "Awaiting business"), `done` (`cancelled` shown only via filter toggle).
- Card body: `code` chip + `title`; `difficulty_level` badge; `comment_count` and `evidences_count` icon counters; assignee avatar pill (or "Unclaimed" placeholder).
- Disable drag-drop into DONE/CANCELLED — those statuses are business-only.
- Show a single-task-in-progress hint near the consultant's avatar when one already exists.

### Self-assign / unassign

- "Claim task" button on `to_do` unclaimed cards.
- "Release" button on `assigned` cards owned by the caller (hidden once the task moves past assigned).

### Status transitions

- `assigned → in_progress` button labelled "Start working" (greyed-out with tooltip when the consultant has another in-progress task).
- `in_progress → in_review` button labelled "Submit for review".
- `in_review → in_progress` link labelled "Reopen" (soft-revert when more work is needed before review is final).

### Comments / evidences

- Use a single rich-text editor component (TipTap) writing directly to the `comment` / `remarks` JSON column.
- Attach files via the existing file-upload pipeline; pass returned `file_id`s into `file_ids`.
- Render `is_edited` as a small "(edited)" caption with a tooltip showing `edited_at`.
- Comments: any member can post; allow update/delete only when `author.user_id === currentUserId`.
- Evidences: only render the "New evidence" CTA when the caller is the task's assignee.
