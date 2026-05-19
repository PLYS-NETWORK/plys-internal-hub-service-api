# ConsultantProjectTasksController — API Specs

> **Source:** [src/modules/consultant-projects/controllers/consultant-project-tasks.controller.ts](../../../../src/modules/consultant-projects/controllers/consultant-project-tasks.controller.ts)
> **Base path:** `/projects/consultant/joined/:projectId/tasks`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)`. The caller must additionally have an `ACTIVE` `project_members` row for the `:projectId` — enforced inside each handler by [`ConsultantAccessService.resolveJoinedProject`](../../../../src/modules/consultant-projects/services/consultant-access.service.ts).
> **Intended caller:** authenticated consultants in the consultant SPA.
> **Response envelope:** `TransformResponseInterceptor` wraps every body into `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). Linked interface files contain the typed shape.

## Authentication

Standard JWT flow — identical to the [Joined controller](joined-api-specs.md). In addition to JWT + role + platform, every endpoint requires an `ACTIVE` `project_members` row for `:projectId`. Missing membership returns 404 `PROJECT_NOT_FOUND` (not 403 — deliberately avoids leaking project existence to non-members).

## Rate limiting

The list endpoint uses [`THROTTLE_DISCOVERY`](../../../../src/common/constants/throttle.constants.ts) (lookups are common). The three write endpoints use [`THROTTLE_STRICT`](../../../../src/common/constants/throttle.constants.ts) — these mutate kanban state and emit notifications, so the limit is tight to absorb double-clicks.

| Endpoint                                                                      | Window | Limit  |
| ----------------------------------------------------------------------------- | ------ | ------ |
| `GET /projects/consultant/joined/:projectId/tasks`                            | 60s    | 60 req |
| `POST /projects/consultant/joined/:projectId/tasks/:taskId/assign`            | 60s    | 5 req  |
| `POST /projects/consultant/joined/:projectId/tasks/:taskId/unassign`          | 60s    | 5 req  |
| `POST /projects/consultant/joined/:projectId/tasks/:taskId/submit-for-review` | 60s    | 5 req  |

When exceeded, the response is `429 Too Many Requests` (surfaced as `error_code: AUTH_RATE_LIMITED`).

## Caching

The list endpoint is the only one cached. Writes invalidate **all** of this consultant's joined-surface keys for the project so the next read reflects the new state immediately.

| Endpoint                                           | TTL | Key shape                                                                        |
| -------------------------------------------------- | --- | -------------------------------------------------------------------------------- |
| `GET /projects/consultant/joined/:projectId/tasks` | 60s | `consultant_joined:tasks:<consultantId>:<projectId>:<page>:<limit>:<keyword-lc>` |

After every successful write (`/assign`, `/unassign`, `/submit-for-review`), [`ConsultantJoinedCacheService.invalidateForConsultantProject`](../../../../src/modules/consultant-projects/services/consultant-joined-cache.service.ts) pattern-deletes the calling consultant's slots:

```
consultant_workspaces:list:<consultantId>:*
consultant_joined:list:<consultantId>:*
consultant_joined:detail:<consultantId>:<projectId>
consultant_joined:tasks:<consultantId>:<projectId>:*
```

Other consultants' caches are untouched (they refresh via TTL). Redis failures are non-fatal — the write succeeds; reads fall back to the DB on the next request.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                                         |
| ---- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token.                                                                |
| 403  | (role/platform)                | Token belongs to a non-`USER` role or active platform ≠ `CONSULTANT`.                        |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Authenticated user has no `consultant_profiles` row.                                         |
| 404  | `PROJECT_NOT_FOUND`            | Caller has no `ACTIVE` membership on `:projectId`, or the project is missing/soft-deleted.   |
| 422  | `GENERIC_VALIDATION_FAILED`    | Path/body/query DTO failures (bad UUID, pagination bounds, `keyword` > 100, malformed body). |
| 429  | `AUTH_RATE_LIMITED`            | Per-route throttler limit exceeded.                                                          |

Endpoint-specific errors are listed below.

---

## Endpoints

### 1. List tasks

Returns the tasks the consultant cares about for the kanban board / task list view: unassigned TO_DO (claimable by anyone) ∪ caller-owned non-DRAFT.

- **Endpoint:** `GET /projects/consultant/joined/:projectId/tasks`
- **Method:** `GET`
- **Throttle:** 60 req / 60s
- **Cache:** 60s
- **Path params:** `projectId` — UUID v4. Bad UUID → 422.
- **Query params:** [`ListConsultantProjectTasksDto`](../../../../src/modules/consultant-projects/dto/requests/list-consultant-project-tasks.dto.ts) extends [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts)

  | Field     | Type     | Required | Notes                                                                              |
  | --------- | -------- | -------- | ---------------------------------------------------------------------------------- |
  | `page`    | `number` | no       | Default `1`. Min `1`.                                                              |
  | `limit`   | `number` | no       | Default `20`. Max `100`.                                                           |
  | `keyword` | `string` | no       | Case-insensitive substring match on `task.title` OR `task.code`. Max length `100`. |

- **Visibility rule:** [`TaskRepository.findVisibleForConsultant`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) filters with:

  ```
  task.project_id = :projectId AND deleted_at IS NULL AND (
    (assigned_to IS NULL AND kanban_status = 'to_do')
    OR
    (assigned_to = :consultantId AND kanban_status <> 'draft')
  )
  ```

  - Unassigned TO_DO tasks surface to every member as **claimable**.
  - The caller's own assignments surface regardless of status — except DRAFT, which is the business owner's private staging.
  - Other consultants' assignments are invisible.

- **Ordering (deterministic):**

  | Bucket | `kanban_status`      |
  | ------ | -------------------- |
  | 1      | `in_progress`        |
  | 2      | `to_do`              |
  | 3      | `in_review`          |
  | 4      | `pending_approval`   |
  | 5      | `revision_requested` |
  | 6      | `done`               |
  | 7      | `cancelled`          |
  | 8      | _(any other)_        |

  Then `task.created_at DESC`, then `task.id ASC` (cross-page stability).

- **Response 200:** `PageDto<`[`IConsultantProjectTaskListItemResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-project-task-list-item.response.interface.ts)`>`

  Item shape:

  ```ts
  {
    id: string,                                                                                     // task uuid
    code: string,                                                                                   // e.g. "AI-1"
    title: string,
    kanban_status: 'to_do' | 'in_progress' | 'in_review' | 'pending_approval'
                 | 'revision_requested' | 'done' | 'cancelled',                                    // never 'draft' on this surface
    price: number,                                                                                  // numeric, dollars (or whatever currency)
    due_date: string | null,                                                                        // ISO 8601
    started_at: string | null,                                                                      // first transition to IN_PROGRESS
    completed_at: string | null,                                                                    // most recent transition to DONE
    assigned_at: string | null,
    is_mine: boolean                                                                                // task.assigned_to === consultantId
  }
  ```

#### Example request

```http
GET /api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks?page=1&limit=20&keyword=webhook
Authorization: Bearer <access_token>
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "data": [
      {
        "id": "11111111-1111-1111-1111-111111111111",
        "code": "AI-3",
        "title": "Implement webhook handler",
        "kanban_status": "in_progress",
        "price": 120.0,
        "due_date": "2026-06-01T00:00:00.000Z",
        "started_at": "2026-05-15T09:00:00.000Z",
        "completed_at": null,
        "assigned_at": "2026-05-15T09:00:00.000Z",
        "is_mine": true
      },
      {
        "id": "22222222-2222-2222-2222-222222222222",
        "code": "AI-7",
        "title": "Webhook retry policy",
        "kanban_status": "to_do",
        "price": 80.0,
        "due_date": null,
        "started_at": null,
        "completed_at": null,
        "assigned_at": null,
        "is_mine": false
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "itemCount": 2,
      "pageCount": 1,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  },
  "timestamp": "2026-05-17T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks"
}
```

---

### 2. Self-assign (claim) a task

- **Endpoint:** `POST /projects/consultant/joined/:projectId/tasks/:taskId/assign`
- **Method:** `POST`
- **Throttle:** 5 req / 60s
- **Path params:** `projectId`, `taskId` — UUID v4. Bad UUID → 422.
- **Request body:** [`AssignConsultantTaskDto`](../../../../src/modules/consultant-projects/dto/requests/assign-consultant-task.dto.ts)

  | Field     | JSON key   | Type                | Required | Notes                                                                                                                             |
  | --------- | ---------- | ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
  | `dueDate` | `due_date` | `string` (ISO-8601) | yes      | Must be a valid Date and **strictly in the future** at request time. Class-validator: `@IsDate()` + `@MinDate(() => new Date())`. |

  ```ts
  // request body
  { "due_date": "2026-06-01T00:00:00.000Z" }
  ```

- **Behaviour (each step short-circuits with the first failing condition):**
  1. Resolve consultant profile + verify `ACTIVE` membership. Missing membership → 404 `PROJECT_NOT_FOUND`.
  2. Project `status` must be `published` or `in_progress`. Otherwise 409 `PROJECT_NOT_JOINABLE`. (DONE / CANCELLED projects close the board for new claims even when the consultant retains an ACTIVE membership row.)
  3. Inside a single transaction:
     1. [`TaskRepository.lockToDoUnassignedTaskById`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) runs `SELECT ... FOR UPDATE SKIP LOCKED` filtered by `project_id = :projectId AND id = :taskId AND kanban_status = 'to_do' AND assigned_to IS NULL`.
     2. If the row is missing, soft-deleted, already assigned, in any non-TO_DO status, OR currently locked by another concurrent claimant → returns `null` → 409 `TASK_NOT_CLAIMABLE`.
     3. Otherwise the row is mutated:
        - `assigned_to = consultantId`
        - `assigned_at = NOW()`
        - `due_date = <input>`
        - `kanban_status = 'in_progress'`
        - `started_at = NOW()` **only when previously null**. Preserves total-worked semantics across `REVISION_REQUESTED → IN_PROGRESS` round-trips.
     4. `tx.tasks.save(locked)` — TypeORM `@VersionColumn` bumps + the row lock together provide defense in depth.
  4. After commit:
     - Invalidate the caller's joined-surface caches.
     - Emit `NOTIFICATION_EVENTS.TASK_STATUS_CHANGED` with `business_user_id` populated so the [notification handler](../../../../src/modules/notifications/services/notification-event-handler.service.ts) fans out a `BUSINESS_TASK_STATUS_CHANGED` notification to the project's owning business user, plus the existing `CONSULTANT_TASK_STATUS_CHANGED` to the consultant.
     - Emission failure is logged and swallowed — never rolls back the DB write.
  5. The DB trigger `trg_log_task_change` automatically writes a `task_history` row capturing the status + assignment change.

- **Response 200:** [`IConsultantTaskSummaryResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-task-summary.response.interface.ts)

  ```ts
  {
    id: string,
    code: string,
    title: string,
    kanban_status: 'in_progress',                  // always 'in_progress' after success
    price: number,
    due_date: string,                              // echoed back from input
    assigned_at: string,                           // ISO 8601 — NOW() at success
    started_at: string,                            // NOW() on first claim, preserved on re-claim
    completed_at: string | null,                   // null unless previously DONE then revised
    project_id: string
  }
  ```

- **Errors (in addition to cross-cutting):**

  | HTTP | error_code              | When                                                                                                                                  |
  | ---- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
  | 409  | `PROJECT_NOT_JOINABLE`  | Project `status` is `draft`, `configured`, `done`, or `cancelled`.                                                                    |
  | 409  | `TASK_NOT_CLAIMABLE`    | Task is missing, soft-deleted, in wrong status, already assigned, OR a concurrent claimant has the row locked.                        |
  | 422  | `TASK_DUE_DATE_INVALID` | Body validation: `due_date` is missing, malformed, not a valid Date, or not strictly in the future. (Surfaced via `class-validator`.) |

#### Example request

```http
POST /api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks/11111111-1111-1111-1111-111111111111/assign
Authorization: Bearer <access_token>
Content-Type: application/json

{ "due_date": "2026-06-01T00:00:00.000Z" }
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "Task assigned successfully.",
  "error_code": null,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "code": "AI-3",
    "title": "Implement webhook handler",
    "kanban_status": "in_progress",
    "price": 120.0,
    "due_date": "2026-06-01T00:00:00.000Z",
    "assigned_at": "2026-05-17T10:00:00.000Z",
    "started_at": "2026-05-17T10:00:00.000Z",
    "completed_at": null,
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2026-05-17T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks/11111111-1111-1111-1111-111111111111/assign"
}
```

#### Example failure — concurrent claim lost the race

```json
{
  "status_code": 409,
  "message": "This task cannot be claimed right now.",
  "error_code": "TASK_NOT_CLAIMABLE",
  "data": null,
  "timestamp": "2026-05-17T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks/11111111-1111-1111-1111-111111111111/assign"
}
```

---

### 3. Self-unassign (release) a task

- **Endpoint:** `POST /projects/consultant/joined/:projectId/tasks/:taskId/unassign`
- **Method:** `POST`
- **Throttle:** 5 req / 60s
- **Path params:** `projectId`, `taskId` — UUID v4.
- **Request body:** none.

- **Behaviour:**
  1. Resolve consultant + verify `ACTIVE` membership. Non-member → 404 `PROJECT_NOT_FOUND`.
  2. Inside a transaction, [`TaskRepository.lockTaskForOwner`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) runs `SELECT ... FOR UPDATE` filtered by `id = :taskId AND project_id = :projectId AND assigned_to = :consultantId AND kanban_status IN ('in_progress')`.
  3. If the lock returns `null`, a non-locking pre-fetch (`tx.tasks.findOne({ where: { id, projectId }})`) disambiguates:
     - Task row missing → 404 `TASK_NOT_FOUND`.
     - `assigned_to !== consultantId` → 403 `TASK_NOT_OWNED_BY_CONSULTANT`.
     - Otherwise (wrong status) → 409 `TASK_INVALID_STATE_FOR_UNASSIGN`.
  4. Mutate the locked row:
     - `assigned_to = null`
     - `assigned_at = null`
     - `due_date = null`
     - `kanban_status = 'to_do'`
     - **`started_at` is preserved** — see entity comment at [task.entity.ts](../../../../src/database/entities/tasks/task.entity.ts#L172-L177). Total worked time across the task's lifetime continues to accumulate across `IN_PROGRESS ↔ TO_DO` round-trips.
  5. `tx.tasks.save(...)` commits the change; the DB trigger writes a `task_history` row.
  6. After commit: invalidate caches + emit `TASK_STATUS_CHANGED` event → business owner gets a `BUSINESS_TASK_STATUS_CHANGED` notification.

- **Response 200:** [`IConsultantTaskSummaryResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-task-summary.response.interface.ts)

  ```ts
  {
    id: string,
    code: string,
    title: string,
    kanban_status: 'to_do',                        // always 'to_do' after success
    price: number,
    due_date: null,                                // always cleared
    assigned_at: null,                             // always cleared
    started_at: string | null,                    // preserved from the original claim
    completed_at: string | null,
    project_id: string
  }
  ```

- **Errors (in addition to cross-cutting):**

  | HTTP | error_code                        | When                                                           |
  | ---- | --------------------------------- | -------------------------------------------------------------- |
  | 404  | `TASK_NOT_FOUND`                  | Task missing, soft-deleted, or belongs to a different project. |
  | 403  | `TASK_NOT_OWNED_BY_CONSULTANT`    | Task is assigned to a different consultant.                    |
  | 409  | `TASK_INVALID_STATE_FOR_UNASSIGN` | Task is in any status other than `in_progress`.                |

#### Example request

```http
POST /api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks/11111111-1111-1111-1111-111111111111/unassign
Authorization: Bearer <access_token>
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "Task unassigned successfully.",
  "error_code": null,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "code": "AI-3",
    "title": "Implement webhook handler",
    "kanban_status": "to_do",
    "price": 120.0,
    "due_date": null,
    "assigned_at": null,
    "started_at": "2026-05-17T10:00:00.000Z",
    "completed_at": null,
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2026-05-17T11:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks/11111111-1111-1111-1111-111111111111/unassign"
}
```

---

### 4. Submit task for review

- **Endpoint:** `POST /projects/consultant/joined/:projectId/tasks/:taskId/submit-for-review`
- **Method:** `POST`
- **Throttle:** 5 req / 60s
- **Path params:** `projectId`, `taskId` — UUID v4.
- **Request body:** none.

- **Behaviour:**
  1. Same access + ownership lock as `/unassign` — `lockTaskForOwner` with `expectedStatuses = ['in_progress', 'revision_requested']`. Accepting `revision_requested` lets the consultant resubmit after the 3+1 reviewers (or AI) bounced the task back with feedback.
  2. On null lock, same disambiguation path:
     - 404 `TASK_NOT_FOUND` / 403 `TASK_NOT_OWNED_BY_CONSULTANT` / 409 `TASK_INVALID_STATE_FOR_SUBMIT`.
  3. Mutate inside the transaction:
     - `kanban_status = 'in_review'`.
     - `last_review_round = last_review_round + 1` (so the new batch of `task_reviews` rows is scoped to a fresh round; the same reviewer may legitimately re-appear on a later round because the `(task_id, reviewer_id, round_number)` uniqueness key includes the round).
     - **All other fields are preserved** (`assigned_to`, `assigned_at`, `due_date`, `started_at`, `revision_count` stay untouched — review is part of the same work session).
  4. **After commit (best-effort, in this order):**
     1. Invalidate caches.
     2. Call [`TaskReviewAssignmentService.assignInitialReviewers`](../../../../src/modules/task-reviews/services/task-review-assignment.service.ts), which picks 2 eligible reviewers (round-robin over `users.role = 'TASK_REVIEWER'`, excluding the consultant + project members + anyone already on this round), inserts pending `task_reviews` rows for the new round, and fires `TASK_REVIEWER_REVIEW_ASSIGNED` events to those reviewers. If the eligible-reviewer pool is exhausted the assignment throws `503 TASK_REVIEW_INSUFFICIENT_REVIEWERS` internally — the error is **logged and swallowed**, so the caller's submit-for-review still returns 200 (the task is already in `IN_REVIEW` and an admin can manually assign reviewers).
     3. Emit `TASK_STATUS_CHANGED` event → consultant receives `CONSULTANT_TASK_STATUS_CHANGED`, business owner receives `BUSINESS_TASK_STATUS_CHANGED` to prompt review.

- **Response 200:** [`IConsultantTaskSummaryResponse`](../../../../src/modules/consultant-projects/dto/responses/interfaces/consultant-task-summary.response.interface.ts)

  ```ts
  {
    id: string,
    code: string,
    title: string,
    kanban_status: 'in_review',                    // always 'in_review' after success
    price: number,
    due_date: string | null,                       // unchanged from prior IN_PROGRESS / REVISION_REQUESTED state
    assigned_at: string,                           // unchanged
    started_at: string,                            // unchanged
    completed_at: string | null,
    project_id: string
  }
  ```

- **Errors (in addition to cross-cutting):**

  | HTTP | error_code                      | When                                                                    |
  | ---- | ------------------------------- | ----------------------------------------------------------------------- |
  | 404  | `TASK_NOT_FOUND`                | Task missing or in a different project.                                 |
  | 403  | `TASK_NOT_OWNED_BY_CONSULTANT`  | Task is assigned to a different consultant.                             |
  | 409  | `TASK_INVALID_STATE_FOR_SUBMIT` | Task is in any status other than `in_progress` or `revision_requested`. |

> **Cross-reference:** Once submitted, the task enters the 3+1 review workflow handled by the [Admin TaskReviewsController](../../admin/task-reviews/task-reviews-api-specs.md).

#### Example request

```http
POST /api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks/11111111-1111-1111-1111-111111111111/submit-for-review
Authorization: Bearer <access_token>
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "Task submitted for review.",
  "error_code": null,
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "code": "AI-3",
    "title": "Implement webhook handler",
    "kanban_status": "in_review",
    "price": 120.0,
    "due_date": "2026-06-01T00:00:00.000Z",
    "assigned_at": "2026-05-17T10:00:00.000Z",
    "started_at": "2026-05-17T10:00:00.000Z",
    "completed_at": null,
    "project_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2026-05-17T12:00:00.000Z",
  "path": "/api/v1/projects/consultant/joined/550e8400-e29b-41d4-a716-446655440000/tasks/11111111-1111-1111-1111-111111111111/submit-for-review"
}
```

---

## State machine

The consultant's surface only operates on a subset of the full kanban graph. Transitions reachable from these endpoints:

```
            assign (TO_DO  → IN_PROGRESS)
TO_DO ──────────────────────────────────────► IN_PROGRESS
   ▲                                              │
   │            unassign (IN_PROGRESS → TO_DO)    │
   └──────────────────────────────────────────────┤
                                                  │
                  submit-for-review               │
                  (IN_PROGRESS → IN_REVIEW)       │
                                                  ▼
                                           IN_REVIEW
```

Transitions out of `IN_REVIEW` (approve / reject / request-revision) belong to the **business** controller — they're not reachable from this surface. `DRAFT`, `ASSIGNED`, `PENDING_APPROVAL`, `REVISION_REQUESTED`, `DONE`, `CANCELLED` are all read-only here.

Behavioural invariants:

- **Status compatibility:** every write rejects when the row is not in the expected starting status. No transitions are best-effort.
- **`started_at` monotonicity:** set on the first IN_PROGRESS transition and never cleared. A consultant who unassigns and re-claims keeps the original `started_at`.
- **`due_date` lifecycle:** required input on assign; cleared on unassign; untouched by submit-for-review.

---

## Concurrency model

- **Assign:** `FOR UPDATE SKIP LOCKED` filtered by `status='to_do' AND assigned_to IS NULL`. Two consultants claiming the same task in parallel — the second one sees `null` and gets `TASK_NOT_CLAIMABLE`. No retry loop is needed in the service; the client decides whether to refresh and try a different task.
- **Unassign / submit:** plain `FOR UPDATE` filtered by `assigned_to = :consultantId AND kanban_status IN ('in_progress')`. Same consultant double-clicking is serialised by the row lock; the second call observes the new status and returns `TASK_INVALID_STATE_FOR_*`.
- **Defense in depth:** the `Task` entity has a TypeORM `@VersionColumn` — even if a slow path slips past the lock filter, `tx.tasks.save()` throws `OptimisticLockVersionMismatchError` rather than silently overwriting.

---

## Side effects: notifications

After every successful commit, the service emits one `task.status.changed` event via `EventEmitter2`. The [NotificationEventHandlerService](../../../../src/modules/notifications/services/notification-event-handler.service.ts) fans out two parallel dispatches via `Promise.allSettled` — individual failures don't abort the other.

| Source action             | Domain event                                                                  | Recipients                                       | Notification types                                                |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| `POST /assign`            | `task.status.changed` with `old_status='to_do', new_status='in_progress'`     | Calling consultant (echo) + owning business user | `CONSULTANT_TASK_STATUS_CHANGED` + `BUSINESS_TASK_STATUS_CHANGED` |
| `POST /unassign`          | `task.status.changed` with `old_status='in_progress', new_status='to_do'`     | Same                                             | Same                                                              |
| `POST /submit-for-review` | `task.status.changed` with `old_status='in_progress', new_status='in_review'` | Same                                             | Same                                                              |

The business-side notification carries the consultant's `actorId` so the business UI can render a "by @Jane Doe" attribution. See [business events catalog](../../business/notifications/notifications-business-events-api-specs.md) for the full payload shape (TBD entry — `business_task_status_changed`).

### Delivery & failure behavior

- Emission happens **post-commit**: a rolled-back transaction never produces a spurious notification.
- The HTTP response is **not blocked** on notification delivery — dispatcher publishes asynchronously after persisting the row.
- `EventEmitter2` errors and dispatcher errors are caught and logged at `warn` level. Notification delivery failure does NOT roll back the kanban transition.
- If the project's `BusinessProfile` row is somehow missing at emit time, the service logs and skips the notification altogether. The status change stands.

---

## Side effects: task history

The Postgres trigger `trg_log_task_change` automatically writes a `task_history` row on every `tasks` `UPDATE`:

| Source action             | `task_history` fields                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /assign`            | `change_type='assignment'`, `previous_kanban_status='to_do'`, `new_kanban_status='in_progress'`, `previous_assigned_to=null`, `new_assigned_to=<consultantId>`   |
| `POST /unassign`          | `change_type='unassignment'`, `previous_kanban_status='in_progress'`, `new_kanban_status='to_do'`, `previous_assigned_to=<consultantId>`, `new_assigned_to=null` |
| `POST /submit-for-review` | `change_type='status_change'`, `previous_kanban_status='in_progress'`, `new_kanban_status='in_review'`, assignment unchanged                                     |

No application-side history insert is required. The business board's history endpoint reads this table directly.

---

## FE rendering suggestions

### Task list

- Render IN_PROGRESS + TO_DO as the top of the list visually; everything else compressed below or behind a "Show more" toggle.
- `is_mine = true` rows should have a different visual treatment (highlight, "Yours" badge).
- TO_DO rows are claimable — show the "Claim" / "Take this task" CTA. Hide the CTA on `is_mine: true` rows (they're already yours in another status).

### Assign flow (claim)

| Trigger                     | UX                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consultant clicks "Claim"   | Open a modal asking for `due_date`. Default to "+7 days" or similar; min = tomorrow.                                                                                        |
| Submit                      | POST `/assign`. On 200, refresh the task list (cache was invalidated server-side).                                                                                          |
| 409 `TASK_NOT_CLAIMABLE`    | Toast "Someone else just claimed this task". Refresh the list.                                                                                                              |
| 409 `PROJECT_NOT_JOINABLE`  | Toast "This project is no longer accepting work" + suggest leaving the project. (Edge case — usually means the business marked it DONE/CANCELLED while the page was stale.) |
| 422 `TASK_DUE_DATE_INVALID` | Inline form error on the due-date field.                                                                                                                                    |

### Unassign flow

- Surface inside an IN_PROGRESS task detail. Confirmation modal recommended ("Are you sure? The task will return to the available pool and `due_date` will be cleared.").
- 409 `TASK_INVALID_STATE_FOR_UNASSIGN` typically means the task has already moved to IN_REVIEW (perhaps the consultant submitted it from another tab). Refresh and reflect the new status.

### Submit-for-review flow

- Surface as the primary CTA on an IN_PROGRESS task detail once the consultant believes the work is complete. Optional: open a small modal listing the task description / acceptance criteria as a final checklist before submitting.
- 409 `TASK_INVALID_STATE_FOR_SUBMIT` indicates the task has already been moved by another tab or by the business; refresh and reconcile.

### Error toast copy suggestions

| error_code                        | Suggested copy                                    |
| --------------------------------- | ------------------------------------------------- |
| `TASK_NOT_CLAIMABLE`              | "This task can no longer be claimed."             |
| `TASK_NOT_OWNED_BY_CONSULTANT`    | "You're not assigned to this task."               |
| `TASK_INVALID_STATE_FOR_UNASSIGN` | "You can only release a task that's in progress." |
| `TASK_INVALID_STATE_FOR_SUBMIT`   | "You can only submit a task that's in progress."  |
| `TASK_DUE_DATE_INVALID`           | "Pick a future date for the deadline."            |
| `PROJECT_NOT_JOINABLE`            | "This project is no longer accepting new work."   |

---

## Sensitive fields — deliberately NOT exposed

- `task.description`, `task.attachments[]` — fetched via separate detail endpoints (business board namespace); the summary DTO is intentionally minimal.
- `task.consultant_payout`, `task.platform_fee_amount`, `task.platform_fee_rate` — pricing breakdown belongs to the financial views, not the action-DTO.
- `task.creation_mode`, `task.code_seq`, `task.display_order`, `task.version`, `task.approved_by`, `task.approved_at`, `task.billing_period_id` — implementation/audit fields, no UI value.
- `task.assigned_to` (the FK uuid) — replaced by the boolean `is_mine` on the list endpoint; the summary DTO omits it entirely.

---

## Out of scope (future steps)

- **Cancellation from the consultant side** — currently only the business owner can transition to CANCELLED.
- **Auto-promotion of REVISION_REQUESTED → IN_PROGRESS on re-claim** — consultant currently has to wait for the business owner to re-assign after a revision request (or this surface needs a new transition).
- **Per-status batch operations** (bulk submit-for-review, bulk unassign) — current endpoints are single-task only.
- **Email channel** for `BUSINESS_TASK_STATUS_CHANGED` — currently in-app + Socket.IO push only.
