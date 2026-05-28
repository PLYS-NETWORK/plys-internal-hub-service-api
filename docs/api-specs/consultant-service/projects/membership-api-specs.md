# ConsultantMembershipController — API Specs

> **Source:** [apps/consultant-service/src/modules/consultant-projects/controllers/consultant-membership.controller.ts](../../../../apps/consultant-service/src/modules/consultant-projects/controllers/consultant-membership.controller.ts)
> **Base path:** `/api/v1/projects/consultant/membership`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), `@Roles(UserRole.USER)`, `@Platform(ActivePlatform.CONSULTANT)` — enforced by the global `JwtAuthGuard`, `RolesGuard`, `PlatformGuard`. No API key.
> **Intended caller:** authenticated consultants in the consultant SPA.
> **Response envelope:** every body is wrapped by `TransformResponseInterceptor` into `{ status_code, message, error_code, data, timestamp, path }`. `error_code` is `null` on success.
> **Field-name convention:** request/response columns below use **snake_case** (the JSON contract). Linked interface files contain the typed shape.

## Authentication

Standard JWT flow — identical to the [Explore controller](explore-api-specs.md):

```
Authorization: Bearer <access_token>
```

- Global `JwtAuthGuard` verifies the token. Missing/invalid → 401 `AUTH_UNAUTHORIZED`.
- Global `RolesGuard` requires `UserRole.USER`. Anything else → 403.
- Global `PlatformGuard` requires `ActivePlatform.CONSULTANT` on the session. Mismatch → 403.
- The user must additionally have a `consultant_profiles` row (resolved via [ConsultantAccessService.resolveConsultantProfile](../../../../apps/consultant-service/src/modules/consultant-projects/services/consultant-access.service.ts)). Missing → 403 `CONSULTANT_PROFILE_NOT_FOUND`.

## Rate limiting

Both routes use the shared [`THROTTLE_STRICT`](../../../../apps/consultant-service/src/common/constants/throttle.constants.ts) tier — these are state-changing writes, so the limit is much tighter than the discovery feed's 60 req/min.

| Endpoint                                                | Window | Limit |
| ------------------------------------------------------- | ------ | ----- |
| `POST /projects/consultant/membership/:projectId/apply` | 60s    | 5 req |
| `POST /projects/consultant/membership/:projectId/leave` | 60s    | 5 req |

When exceeded, the response is `429 Too Many Requests` (surfaced as `error_code: AUTH_RATE_LIMITED`). UI should debounce double-clicks and surface a generic "moving fast" toast.

## Caching

The membership endpoints are **not** themselves cached — they're writes. They DO invalidate the calling consultant's explore caches on success so the next `/projects/consultant/explore[/...]` read returns the new `is_joined` / `is_available_to_apply` values immediately (no 60–120 s TTL wait):

| Action         | Keys deleted (via `redis.keys()` → `del()`)              |
| -------------- | -------------------------------------------------------- |
| Apply or leave | `consultant_explore:list:<consultantId>:*`               |
| Apply or leave | `consultant_explore:detail:<consultantId>:*:<projectId>` |

Only the calling consultant's slots are touched. Other consultants' caches still hold their previous view and will refresh via TTL. Redis failures are non-fatal — the service logs a warning and falls back to the standard TTL.

## Cross-cutting errors

| HTTP | error_code                     | When                                                                  |
| ---- | ------------------------------ | --------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`            | Missing/invalid Bearer token.                                         |
| 403  | (role/platform)                | Token belongs to a non-`USER` role or active platform ≠ `CONSULTANT`. |
| 403  | `CONSULTANT_PROFILE_NOT_FOUND` | Authenticated user has no `consultant_profiles` row.                  |
| 404  | `PROJECT_NOT_FOUND`            | Project missing or soft-deleted.                                      |
| 422  | `GENERIC_VALIDATION_FAILED`    | Path param failures (bad UUID).                                       |
| 429  | `AUTH_RATE_LIMITED`            | Per-route throttler limit exceeded.                                   |

Endpoint-specific errors are listed below.

---

## Endpoints

### 1. Apply (join) a project

- **Endpoint:** `POST /projects/consultant/membership/:projectId/apply`
- **Method:** `POST`
- **Throttle:** 5 req / 60s
- **Path params:** `projectId` — UUID v4 (`ParseUUIDPipe({ version: '4' })`). Bad UUID → 422.
- **Request body:** none.
- **Behaviour (each step short-circuits with the first failing condition):**
  1. Resolve the caller's consultant profile via `RequestContextService.userId`. Missing profile → 403 `CONSULTANT_PROFILE_NOT_FOUND`.
  2. Load project. Missing/soft-deleted → 404 `PROJECT_NOT_FOUND`.
  3. Project `status` must be `published` or `in_progress`. Otherwise 409 `PROJECT_NOT_JOINABLE`.
  4. Look up the existing `project_members` row (unique constraint `(projectId, consultantId)`):
     - **ACTIVE** → 409 `PROJECT_ALREADY_MEMBER`.
     - **REMOVED** → 403 `PROJECT_MEMBERSHIP_BANNED` (admin/business action; cannot be reversed by the consultant).
     - **LEFT** → fall through; the existing row will be reactivated inside the transaction.
     - **none** → fall through; a new row will be inserted inside the transaction.
  5. Skill match gate: `Math.round((matchedCount / requiredCount) * 100)` must be `≥ 50`. Vacuously satisfied when the project has zero required skills. Otherwise 422 `PROJECT_SKILL_MATCH_INSUFFICIENT`.
  6. Concurrency cap: caller's active membership count must be `< MAX_CONCURRENT_PROJECTS` (currently `5`). Otherwise 409 `PROJECT_CONCURRENT_LIMIT_REACHED`. The DB trigger [`trg_enforce_consultant_project_limit`](../../../../apps/consultant-service/src/database/entities/projects/project-member.entity.ts) enforces the same limit at insert time; the application-layer pre-check exists to surface a friendly error code.
  7. Inside a single transaction:
     1. Re-load the project under `SELECT ... FOR UPDATE` (pessimistic write lock) via [`ProjectRepository.findByIdForUpdate`](../../../../packages/unit-of-work/repositories/projects/project.repository.ts). Disappearing project under the lock → 404 `PROJECT_NOT_FOUND`.
     2. Count active members. If `count >= required_consultants` → 409 `PROJECT_FULL`.
     3. Insert (no prior row) or reactivate (LEFT → ACTIVE). The lock is held until commit, so two parallel applies cannot both pass the capacity check.
  8. After commit, invalidate the caller's explore caches and return the membership snapshot.

- **Response 200:** [`IConsultantMembershipResponse`](../../../../apps/consultant-service/src/modules/consultant-projects/dto/responses/interfaces/consultant-membership.response.interface.ts)

  ```ts
  {
    project_id: string,                                                // uuid
    status: 'active',                                                  // ACTIVE after a successful apply
    joined_at: string,                                                 // ISO 8601 — set to NOW() on each apply (including re-apply)
    left_at: null                                                      // always null after apply (cleared on re-apply too)
  }
  ```

- **Errors (in addition to cross-cutting):**

  | HTTP | error_code                         | When                                                                                          |
  | ---- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
  | 409  | `PROJECT_NOT_JOINABLE`             | Project is not `published` / `in_progress` (e.g. `draft`, `configured`, `done`, `cancelled`). |
  | 409  | `PROJECT_ALREADY_MEMBER`           | Caller already has an `ACTIVE` membership on this project.                                    |
  | 403  | `PROJECT_MEMBERSHIP_BANNED`        | Caller was previously REMOVED by an admin/business; cannot re-apply.                          |
  | 422  | `PROJECT_SKILL_MATCH_INSUFFICIENT` | Caller's matched required skills < 50% of the project's required skills.                      |
  | 409  | `PROJECT_CONCURRENT_LIMIT_REACHED` | Caller already has the maximum active memberships (`5`).                                      |
  | 409  | `PROJECT_FULL`                     | Active member count has reached `required_consultants` (checked atomically under the lock).   |

#### Example request

```http
POST /api/v1/projects/consultant/membership/550e8400-e29b-41d4-a716-446655440000/apply
Authorization: Bearer <access_token>
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "You have successfully joined the project.",
  "error_code": null,
  "data": {
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "active",
    "joined_at": "2026-05-16T10:00:00.000Z",
    "left_at": null
  },
  "timestamp": "2026-05-16T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/membership/550e8400-e29b-41d4-a716-446655440000/apply"
}
```

#### Example failure — insufficient skill match

```json
{
  "status_code": 422,
  "message": "Your skills match less than 50% of this project's required skills.",
  "error_code": "PROJECT_SKILL_MATCH_INSUFFICIENT",
  "data": null,
  "timestamp": "2026-05-16T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/membership/550e8400-e29b-41d4-a716-446655440000/apply"
}
```

---

### 2. Leave a project

- **Endpoint:** `POST /projects/consultant/membership/:projectId/leave`
- **Method:** `POST`
- **Throttle:** 5 req / 60s
- **Path params:** `projectId` — UUID v4. Bad UUID → 422.
- **Request body:** none.
- **Behaviour:**
  1. Resolve consultant profile.
  2. Load project. Missing/soft-deleted → 404 `PROJECT_NOT_FOUND`.
  3. Load the caller's membership row. If it doesn't exist or `status ≠ ACTIVE` → 403 `PROJECT_NOT_MEMBER`.
  4. Run [`TaskRepository.countByAssigneeAndProjectGroupedByStatus(consultantId, projectId)`](../../../../packages/unit-of-work/repositories/tasks/task.repository.ts). Sum counts across the **blocking** statuses:
     - `IN_PROGRESS`, `IN_REVIEW`, `PENDING_APPROVAL`, `REVISION_REQUESTED`
       If the sum is `> 0` → 409 `PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS`.
     - **Non-blocking** statuses (work hasn't started or the task is already terminal): `TO_DO`, `ASSIGNED`, `DONE`, `CANCELLED`. `DRAFT` tasks have no assignee by definition.
  5. Flip status to `LEFT`, record `left_at = NOW()`. `joined_at` is preserved (it can be inspected post-leave; on a re-apply it gets reset).
  6. Invalidate the caller's explore caches and return the membership snapshot.

- **Response 200:** [`IConsultantMembershipResponse`](../../../../apps/consultant-service/src/modules/consultant-projects/dto/responses/interfaces/consultant-membership.response.interface.ts)

  ```ts
  {
    project_id: string,
    status: 'left',
    joined_at: string,                                                 // ISO 8601 — preserved from the original join
    left_at: string                                                    // ISO 8601 — set to NOW()
  }
  ```

- **Errors (in addition to cross-cutting):**

  | HTTP | error_code                              | When                                                                                                                                                     |
  | ---- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 403  | `PROJECT_NOT_MEMBER`                    | Caller is not an `ACTIVE` member of the project (no row, or row in `LEFT`/`REMOVED`).                                                                    |
  | 409  | `PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS` | Caller has ≥1 assigned task on this project in `{IN_PROGRESS, IN_REVIEW, PENDING_APPROVAL, REVISION_REQUESTED}`. Complete or hand off those tasks first. |

#### Example request

```http
POST /api/v1/projects/consultant/membership/550e8400-e29b-41d4-a716-446655440000/leave
Authorization: Bearer <access_token>
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "You have left the project.",
  "error_code": null,
  "data": {
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "left",
    "joined_at": "2026-05-10T08:42:00.000Z",
    "left_at": "2026-05-16T10:00:00.000Z"
  },
  "timestamp": "2026-05-16T10:00:00.000Z",
  "path": "/api/v1/projects/consultant/membership/550e8400-e29b-41d4-a716-446655440000/leave"
}
```

---

## Re-apply semantics

The `(projectId, consultantId)` unique constraint (`uq_project_members_project_consultant`) means a consultant has at most **one** row per project at any time. The apply flow handles the LEFT → ACTIVE transition by **mutating the existing row**, not by inserting a new one:

| Existing row state | Apply behavior                                                            |
| ------------------ | ------------------------------------------------------------------------- |
| _(no row)_         | Insert with `status='active'`, `joined_at=NOW()`, `left_at=null`.         |
| `ACTIVE`           | Reject with 409 `PROJECT_ALREADY_MEMBER`.                                 |
| `LEFT`             | Reactivate: `status='active'`, `joined_at=NOW()` (reset), `left_at=null`. |
| `REMOVED`          | Reject with 403 `PROJECT_MEMBERSHIP_BANNED` (admin/business decision).    |

This is by design — a consultant who left voluntarily can return; a consultant removed by an admin/business cannot.

---

## Concurrency model

The capacity check (`active_count < required_consultants`) and the insert/reactivate happen inside a single transaction guarded by `SELECT ... FOR UPDATE` on the `projects` row. This prevents the race where two parallel apply requests both pass the capacity check and both insert — only the first one through the lock can commit; the second observes the updated count and returns `PROJECT_FULL`.

The per-consultant concurrency cap (`MAX_CONCURRENT_PROJECTS = 5`) is also enforced by the DB trigger `trg_enforce_consultant_project_limit` (see entity comment at [project-member.entity.ts](../../../../apps/consultant-service/src/database/entities/projects/project-member.entity.ts#L15-L17)). The application-layer pre-check exists so we can return `PROJECT_CONCURRENT_LIMIT_REACHED` instead of a raw DB error.

---

## Activity feed integration

Successful applies surface in [`ProjectActivityRepository.findEventsByProjectId`](../../../../packages/unit-of-work/repositories/projects/project-activity.repository.ts) as `member_joined` events — the CTE selects from `project_members WHERE status='active'`, so a `LEFT` member is automatically filtered out from the feed.

There is **no** `member_left` event type at this time. If product wants to surface leaves in the activity feed, a follow-up step needs to either add a new event type or change the CTE filter.

---

## Side effects: notifications

After a successful commit (and after the consultant's own `consultant_explore` caches are invalidated), the service emits a domain event via `EventEmitter2`. The [NotificationEventHandlerService](../../../../apps/consultant-service/src/modules/notifications/services/notification-event-handler.service.ts) listens and fans out four delivery channels in parallel via `Promise.allSettled` — individual dispatch failures do not abort the others.

### On apply (`POST /apply` → success)

Domain event emitted: `consultant.project.joined` ([`IConsultantProjectJoinedEvent`](../../../../apps/consultant-service/src/common/events/consultant.events.ts))

| Recipient            | Notification type                                                       | Catalog reference                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Calling consultant   | `consultant_project_joined` — confirmation on their own inbox           | [consultant events catalog](../notifications/notifications-consultant-events-api-specs.md)                                                       |
| Owning business user | `project_consultant_joined` — "Jane Doe joined your project"            | [business events catalog § 8](../../business-service/notifications/notifications-business-events-api-specs.md#8-project_consultant_joined)       |
| Every active admin   | `admin_consultant_project_joined` — broadcast via `dispatchToAllAdmins` | [admin events catalog § 8](../../internal-admin-service/notifications/notifications-admin-events-api-specs.md#8-admin_consultant_project_joined) |

### On leave (`POST /leave` → success)

Domain event emitted: `consultant.project.left` ([`IConsultantProjectLeftEvent`](../../../../apps/consultant-service/src/common/events/consultant.events.ts))

| Recipient            | Notification type                                                     | Catalog reference                                                                                                                              |
| -------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Owning business user | `project_consultant_left` — "Jane Doe left your project"              | [business events catalog § 9](../../business-service/notifications/notifications-business-events-api-specs.md#9-project_consultant_left)       |
| Every active admin   | `admin_consultant_project_left` — broadcast via `dispatchToAllAdmins` | [admin events catalog § 9](../../internal-admin-service/notifications/notifications-admin-events-api-specs.md#9-admin_consultant_project_left) |

No consultant-side notification is emitted on leave — the API response itself is the confirmation.

### Delivery & failure behavior

- Emission happens **post-commit**: a rolled-back transaction never produces a spurious notification.
- The HTTP response is **not blocked** on notification delivery — the dispatcher publishes to Redis pub/sub (Socket.IO `notification.new` fan-out) asynchronously after persisting the row.
- `EventEmitter2` errors and dispatcher errors are caught and logged at `warn` level. Notification delivery failure does NOT roll back the membership change.
- If the project's `BusinessProfile` row is somehow missing at emit time, the service logs and skips ALL notifications (admin + business) for that event. The membership state is unaffected.

---

## FE rendering suggestions

### Apply CTA (typically on a project card or detail hero)

| State (from explore endpoint)                      | CTA copy             | onClick                                                     |
| -------------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| `is_joined: true`                                  | "Open project board" | Navigate to overview/board (later steps).                   |
| `is_joined: false`, `is_available_to_apply: true`  | "Request to join"    | Calls `apply`. On 200, refresh explore.                     |
| `is_joined: false`, `is_available_to_apply: false` | "Apply" (disabled)   | Tooltip: "Roster full" / "You've reached your project cap." |

After a successful apply, the FE should re-fetch the explore list/detail — the consultant's `is_joined` flag updates immediately because the cache was invalidated server-side.

### Apply error toasts

| error_code                         | Suggested copy                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PROJECT_NOT_JOINABLE`             | "This project isn't accepting new members right now."                                                      |
| `PROJECT_ALREADY_MEMBER`           | "You're already part of this project."                                                                     |
| `PROJECT_MEMBERSHIP_BANNED`        | "You can't rejoin this project."                                                                           |
| `PROJECT_SKILL_MATCH_INSUFFICIENT` | "You match less than half of the required skills. Add more matching skills to your profile and try again." |
| `PROJECT_CONCURRENT_LIMIT_REACHED` | "You've reached the maximum of 5 active projects. Wrap up or leave one first."                             |
| `PROJECT_FULL`                     | "Someone else filled the last slot. Try again on another project."                                         |

### Leave button

Surface on the consultant's "My projects" / project detail view. Confirmation modal recommended — this is irreversible (other than re-applying, which requires passing the skill gate again).

### Leave error: blocked by active tasks

When `PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS` fires, the FE could:

- Show a modal listing the blocking task statuses ("You have N tasks in review / N tasks in progress…") and route the consultant to their kanban board.
- Surface a "Cannot leave yet" disabled state on the button with a tooltip explaining why.

The current response payload doesn't break down the count per status — the service logs it for ops but doesn't expose it to the client. If FE needs per-status counts in the modal, a follow-up can extend the response. Note logged as a TODO in the plan file.

---

## Sensitive fields — deliberately NOT exposed

The membership DTO is intentionally minimal. The following are **not** returned even though they exist on the entity:

- `id` (`project_members.id`) — implementation detail; clients use `project_id` to correlate.
- `consultant_id` — redundant with the JWT identity; never echoed to the caller.
- `createdBy` / `updatedBy` / `deletedBy` / `createdAt` / `updatedAt` — audit columns, irrelevant to UI.

---

## Out of scope (future steps)

- A `member_left` activity-feed event type.
- Per-status task counts in the `PROJECT_LEAVE_BLOCKED_BY_ACTIVE_TASKS` response payload.
- Email fallback for the four membership notifications — currently delivered via the in-app channel + Socket.IO push only.
- Admin "force-remove" flow (sets `status=REMOVED`) — belongs in the admin module.
