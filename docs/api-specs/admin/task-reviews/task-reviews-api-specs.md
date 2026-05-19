# TaskReviewsController — API Specs

> **Source:** [src/modules/task-reviews/task-reviews.controller.ts](../../../../src/modules/task-reviews/task-reviews.controller.ts)
> **Base path:** `/admin/task-reviews`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`), class-level `@Roles(UserRole.ADMIN_PLATFORM, UserRole.TASK_REVIEWER)`. Both platform admins and internal task reviewers can reach the controller — admins for read-only oversight, reviewers for actual voting. The vote endpoint additionally checks that the caller's userId matches `task_reviews.reviewer_id`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).

This controller is the human-side of the "3+1" task delivery workflow: **3 internal reviewers** (users with `role = TASK_REVIEWER`, auto-provisioned via the [admin allow-list](../auth/admin-allowed-emails-api-specs.md)) cast PASS / FAIL votes; a **1** AI quality gate (currently a stub) runs after a unanimous PASS. The consumer of these endpoints is the Internal Hub frontend.

---

## Background — the 3+1 workflow

```
IN_PROGRESS ─submitForReview──▶ IN_REVIEW
                                   │
                  auto-assign 2 reviewers (round-robin)
                                   ▼
                  reviewer votes (PASS / FAIL)
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
       both vote PASS       both vote FAIL        1-1 split
              │                    │                    │
              ▼                    ▼                    ▼
     PENDING_APPROVAL      REVISION_REQUESTED  assign Arbiter (3rd reviewer)
       (AI check)                                       │
              │                                         ▼
        AI evaluates                          ALWAYS REVISION_REQUESTED
              │                               (split = doubt; arbiter only
        ┌─────┴─────┐                          adds the final feedback line)
        ▼           ▼
       PASS        FAIL ──▶ REVISION_REQUESTED
        │
        ▼
       DONE  ──▶ ConsultantTransaction(CREDIT_CLEARED) + consultant.account_balance++
```

**Status semantics:**

- `IN_REVIEW` — round is open; reviewers can vote.
- `PENDING_APPROVAL` — initial reviewers unanimously passed; AI gate is running asynchronously. **Cannot be voted on.**
- `REVISION_REQUESTED` — round has resolved with a bounce-back. Consultant resubmits via the [consultant tasks endpoint](../../consultant/projects/tasks-api-specs.md); a new round begins (`last_review_round` increments).
- `DONE` — AI gate returned PASS. A `consultant_transactions` row with `type = CREDIT_CLEARED` and `amount = task.consultant_payout` has been inserted in the **same DB transaction** as the status flip, and the consultant's `account_balance` has been incremented atomically.
- After **3 cumulative revision rounds** the next `markRevisionRequested` parks the task at `PENDING_APPROVAL` and opens a `task_disputes` row instead of bouncing back to the consultant. The next bounce-back attempt is the escalation; no further `REVISION_REQUESTED` transition occurs for that task.

---

## Authentication & authorisation

Standard JWT flow via the admin OTP login at [`/admin/auth/*`](../auth/auth-api-specs.md). After verifying the OTP, `users.role` is read from the `admin_allowed_emails` row matching the email — so an invited `TASK_REVIEWER` ends up with role `TASK_REVIEWER` and a JWT carrying `platform = admin_platform`.

Per-endpoint authorisation:

| Endpoint                                  | Allowed roles                     | Additional checks                                                                                                                        |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /admin/task-reviews/pending`         | `ADMIN_PLATFORM`, `TASK_REVIEWER` | None. Admins see an empty page unless the same user id was assigned a review.                                                            |
| `GET /admin/task-reviews/:reviewId`       | `ADMIN_PLATFORM`, `TASK_REVIEWER` | `TASK_REVIEWER` callers may only read their own rows; admins may read any row.                                                           |
| `POST /admin/task-reviews/:reviewId/vote` | `ADMIN_PLATFORM`, `TASK_REVIEWER` | Only the assigned reviewer (`task_reviews.reviewer_id == requestContext.userId`) can submit; admins receive `403 TASK_REVIEW_FORBIDDEN`. |

## Rate limiting

All endpoints use [`THROTTLE_DEFAULT`](../../../../src/common/constants/throttle.constants.ts).

## Cross-cutting errors

| HTTP | error_code                           | When                                                                                |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                  | Missing/invalid Bearer token (global `JwtAuthGuard`).                               |
| 403  | (role/platform)                      | Caller is not `ADMIN_PLATFORM` or `TASK_REVIEWER`.                                  |
| 404  | `TASK_REVIEW_NOT_FOUND`              | Review row missing or soft-deleted.                                                 |
| 403  | `TASK_REVIEW_FORBIDDEN`              | Reviewer reads/votes on a review not assigned to them; or admin tries to vote.      |
| 409  | `TASK_REVIEW_ALREADY_VOTED`          | Vote re-submitted (the row's decision is no longer `pending`).                      |
| 409  | `TASK_REVIEW_ROUND_CLOSED`           | Task is no longer in `IN_REVIEW`, or `last_review_round` advanced past this review. |
| 400  | `TASK_REVIEW_INVALID_DECISION`       | Body `decision` is anything other than `pass` or `fail`.                            |
| 503  | `TASK_REVIEW_INSUFFICIENT_REVIEWERS` | Cannot find enough eligible reviewers (initial pool < 2, or no arbiter available).  |
| 422  | (validation)                         | DTO failures: bad UUID, missing `decision`, `feedback` > 2 000 chars, pagination.   |
| 429  | `AUTH_RATE_LIMITED`                  | Throttler limit exceeded.                                                           |

`TASK_REVIEW_INSUFFICIENT_REVIEWERS` does **not** surface from `POST /vote` directly — it is raised by the assignment side-effect that runs after a 1-1 split. The vote response is `204`; the split-resolution failure is logged on the server and surfaces back to the FE only through the absence of an arbiter row on the next `GET /:reviewId` poll. The same code can surface from the consultant `submit-for-review` flow if the pool is empty at submission time — there too the error is logged and swallowed.

---

## Endpoints

### 1. List pending review assignments

Returns the caller's queue of reviews still awaiting their vote.

- **Endpoint:** `GET /admin/task-reviews/pending`
- **Method:** `GET`
- **Query params:** [`ListPendingReviewsDto`](../../../../src/modules/task-reviews/dto/requests/list-pending-reviews.dto.ts) extends [`PageOptionsDto`](../../../../src/common/dto/page-options.dto.ts)

  | Field   | Type     | Required | Notes                             |
  | ------- | -------- | -------- | --------------------------------- |
  | `page`  | `number` | no       | Default `1`. Min `1`.             |
  | `limit` | `number` | no       | Default `20`. Min `1`. Max `100`. |

- **Behaviour:**
  - Filters to `task_reviews.reviewer_id = requestContext.userId` AND `decision = 'pending'` AND `deleted_at IS NULL`.
  - Joins `tasks` so `task_code`, `task_title`, and `project_id` are returned without a second round-trip.
  - Sorted by `assigned_at ASC` (oldest assignments first) so the queue is a deterministic FIFO.
  - **Admin callers** see an empty page unless they happen to share a user id with a `task_reviews` row — typically only the case in seeded test environments.

- **Response 200:** `PageDto<ITaskReviewResponse>`

  ```ts
  {
    data: [
      {
        id: string,             // UUID — task_reviews.id
        task_id: string,        // UUID
        task_code: string,      // e.g. "WEB-12"
        task_title: string,
        project_id: string,
        round_number: number,   // matches tasks.last_review_round at the time the row was inserted
        is_arbiter: boolean,    // true when the row was created as a tie-breaker for a 1-1 split
        decision: "pending",    // always "pending" on this endpoint
        assigned_at: string,    // ISO-8601
        voted_at: null
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

#### Example request

```http
GET /api/v1/admin/task-reviews/pending?page=1&limit=20
Authorization: Bearer <access_token>
```

---

### 2. Get a single review with task context

Returns one review row plus the task fields the reviewer needs in order to decide.

- **Endpoint:** `GET /admin/task-reviews/:reviewId`
- **Method:** `GET`
- **Path params:** `reviewId` (UUID v4). Bad UUID → 422.

- **Behaviour:**
  - Loads the review with `INNER JOIN tasks` + `LEFT JOIN users reviewer`.
  - **Authorisation:**
    - `ADMIN_PLATFORM` → may read any row (oversight).
    - `TASK_REVIEWER` → may only read rows where `reviewer_id = requestContext.userId`; otherwise `403 TASK_REVIEW_FORBIDDEN`.
  - Returns task metadata required for the reviewer UI: the description (JSONB body), price, post-fee `consultant_payout`, and the assignee id (so the reviewer can confirm the work belongs to a real consultant).

- **Response 200:** [`ITaskReviewDetailResponse`](../../../../src/modules/task-reviews/dto/responses/interfaces/task-review.response.interface.ts)

  ```ts
  {
    id: string,
    task_id: string,
    task_code: string,
    task_title: string,
    project_id: string,
    round_number: number,
    is_arbiter: boolean,
    decision: "pending" | "pass" | "fail" | "recused" | "voided",
    assigned_at: string,
    voted_at: string | null,
    task_description: object | null,        // JSONB body — pass-through from tasks.description
    task_price: string,                     // decimal, e.g. "100.00"
    task_consultant_payout: string,         // task.price * (1 - platform_fee_rate)
    task_assignee_id: string | null         // consultant_profiles.id of the worker
  }
  ```

- **Errors:**

  | HTTP | error_code              | When                                                               |
  | ---- | ----------------------- | ------------------------------------------------------------------ |
  | 404  | `TASK_REVIEW_NOT_FOUND` | No row with this id.                                               |
  | 403  | `TASK_REVIEW_FORBIDDEN` | `TASK_REVIEWER` caller and `reviewer_id != requestContext.userId`. |

---

### 3. Submit a PASS / FAIL vote

The actual voting endpoint. Triggers the resolution rule synchronously inside a pessimistic-write transaction so two reviewers cannot both resolve a round.

- **Endpoint:** `POST /admin/task-reviews/:reviewId/vote`
- **Method:** `POST`
- **Path params:** `reviewId` (UUID v4).
- **Request body:** [`SubmitVoteDto`](../../../../src/modules/task-reviews/dto/requests/submit-vote.dto.ts)

  | Field      | Type               | Required | Notes                                                                                                                               |
  | ---------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | `decision` | `"pass" \| "fail"` | yes      | Anything else → `400 TASK_REVIEW_INVALID_DECISION`.                                                                                 |
  | `feedback` | `string`           | no       | Plain text, max `2000` characters. Trimmed; empty after trim is stored as `null`. Surfaced to the consultant on REVISION_REQUESTED. |

- **Behaviour:**

  Inside a single `withTransaction` block:
  1. `findByIdWithLock(reviewId)` — `SELECT ... FOR UPDATE`. Missing → `404 TASK_REVIEW_NOT_FOUND`. `reviewer_id != callerId` → `403 TASK_REVIEW_FORBIDDEN`. Already voted → `409 TASK_REVIEW_ALREADY_VOTED`.
  2. `lockTaskForReview(taskId, ['in_review'])` — re-locks the parent task to serialise simultaneous votes. Returns null when the task is in any other status → `409 TASK_REVIEW_ROUND_CLOSED`. Also returns 409 when `tasks.last_review_round != review.round_number` (the review belongs to a round that already closed).
  3. `recordVote(reviewId, decision, feedback ?? null)` — sets `decision`, `feedback`, `voted_at = NOW()`.
  4. `tallyDecisions(task_id, round_number)` — count PASS / FAIL / PENDING across the round.
  5. Resolution branch (the side-effects below run **after** the vote tx commits, so the reviewer's response returns first):

     | Round state after this vote                             | Side-effects                                                                                                                                                                                                                                                                                                  |
     | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
     | 2 votes, both PASS (no arbiter yet)                     | Task `kanban_status = 'pending_approval'`. Emit `TASK_AI_REVIEW_REQUESTED` event → [`TaskAiReviewHandler`](../../../../src/modules/task-reviews/handlers/task-ai-review.handler.ts) runs the stub AI gate (`AiQualityCheckService` currently returns `pass`) and calls `markDone` or `markRevisionRequested`. |
     | 2 votes, both FAIL                                      | Skip AI. Call `TaskCompletionService.markRevisionRequested` with the consolidated feedback summary built from both reviewers' notes. Increments `revision_count`; escalates to `task_disputes` once the cap (3) is exceeded.                                                                                  |
     | 2 votes, 1 PASS + 1 FAIL                                | Call `TaskReviewAssignmentService.assignArbiter` — picks a 3rd eligible reviewer (`is_arbiter = true`), inserts a `task_reviews` row in the same round, fires `TASK_REVIEWER_REVIEW_ASSIGNED`. Task stays `IN_REVIEW`.                                                                                        |
     | Arbiter vote arrives (3 rows decided, one `is_arbiter`) | **Always** call `markRevisionRequested` regardless of the arbiter's PASS/FAIL. The arbiter's verdict is appended to the consolidated feedback narrative but does NOT flip the outcome — any 1-1 split is treated as enough doubt to bounce back.                                                              |
     | Anything else (1 vote only, or unexpected shape)        | No side-effects — wait for the next vote.                                                                                                                                                                                                                                                                     |

  6. The DONE finalisation (when the AI gate passes) runs in `TaskCompletionService.markDone` inside its own `withTransaction`:
     - `tasks.kanban_status = 'done'`, `completed_at = NOW()`, `approved_at = NOW()`.
     - Insert one `consultant_transactions` row: `type = 'CREDIT_CLEARED'`, `amount = task.consultant_payout`, `status = 'COMPLETED'`, `task_id` + `project_id` set, `transaction_number` allocated via `transactionNumbers.next('LN', 'CREDIT_CLEARED')`.
     - `consultantProfiles.incrementAccountBalance(consultant_id, amount)` — atomic SQL `account_balance + :amount` so concurrent task completions cannot lose writes.
     - Emit `TASK_STATUS_CHANGED` with `earned_amount` populated → consultant receives `CONSULTANT_TASK_STATUS_CHANGED` with the earnings amount in metadata.

- **Response 204:** No content.

- **Errors (in addition to cross-cutting):**

  | HTTP | error_code                     | When                                                                                                                                   |
  | ---- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
  | 400  | `TASK_REVIEW_INVALID_DECISION` | `decision` is not `pass` or `fail`.                                                                                                    |
  | 403  | `TASK_REVIEW_FORBIDDEN`        | Caller is not the assigned reviewer (incl. admin callers — admins read but do not vote).                                               |
  | 404  | `TASK_REVIEW_NOT_FOUND`        | No row with this id.                                                                                                                   |
  | 409  | `TASK_REVIEW_ALREADY_VOTED`    | This review's decision is not `pending`. The unique constraint `(task_id, reviewer_id, round_number)` also prevents duplicate inserts. |
  | 409  | `TASK_REVIEW_ROUND_CLOSED`     | Task moved out of `IN_REVIEW` between fetch and vote, or the review is for a prior round.                                              |

#### Example request

```http
POST /api/v1/admin/task-reviews/22222222-2222-2222-2222-222222222222/vote
Authorization: Bearer <reviewer_access_token>
Content-Type: application/json

{
  "decision": "pass",
  "feedback": "Deliverable matches the acceptance criteria; documentation is clear."
}
```

#### Example success response

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": null,
  "timestamp": "2026-05-19T15:30:00.000Z",
  "path": "/api/v1/admin/task-reviews/22222222-2222-2222-2222-222222222222/vote"
}
```

#### Example failure — admin tries to vote

```json
{
  "status_code": 403,
  "message": "You are not the assigned reviewer for this task.",
  "error_code": "TASK_REVIEW_FORBIDDEN",
  "data": null,
  "timestamp": "2026-05-19T15:30:01.000Z",
  "path": "/api/v1/admin/task-reviews/22222222-2222-2222-2222-222222222222/vote"
}
```

---

## How a reviewer ends up assigned

1. A platform admin invites the reviewer's email via `POST /admin/allowed-emails` with `{ "role": "TASK_REVIEWER" }`. See the [allowed-emails spec](../auth/admin-allowed-emails-api-specs.md).
2. The reviewer logs in via the admin OTP flow. `AdminAuthService.findOrCreateAdminUser` reads `role = TASK_REVIEWER` off the allow-list row and writes it onto the new `users` row.
3. A consultant submits a task for review. `ConsultantProjectTasksService.submitForReview` increments `tasks.last_review_round` and calls `TaskReviewAssignmentService.assignInitialReviewers`, which picks **2 eligible** reviewers via [`TaskRepository.pickEligibleReviewers`](../../../../src/modules/unit-of-work/repositories/tasks/task.repository.ts) — `role = 'TASK_REVIEWER' AND is_active = TRUE`, excluding the consultant + project members, round-robin biased toward the least recently assigned.
4. Each picked reviewer receives a `TASK_REVIEWER_REVIEW_ASSIGNED` notification (see [Common payload shape](#cross-references) below).

If voting yields a 1-1 split, `assignArbiter` runs the same selection with a count of 1 and `is_arbiter = true`. The arbiter receives the same `TASK_REVIEWER_REVIEW_ASSIGNED` notification (`is_arbiter: true` in metadata).

---

## Cross-references

- **Service entry-points:** [`TaskReviewVotingService`](../../../../src/modules/task-reviews/services/task-review-voting.service.ts), [`TaskReviewAssignmentService`](../../../../src/modules/task-reviews/services/task-review-assignment.service.ts), [`TaskCompletionService`](../../../../src/modules/task-reviews/services/task-completion.service.ts), [`AiQualityCheckService`](../../../../src/modules/task-reviews/services/ai-quality-check.service.ts) (current implementation is a stub returning PASS).
- **Async handler:** [`TaskAiReviewHandler`](../../../../src/modules/task-reviews/handlers/task-ai-review.handler.ts) — `@OnEvent(TASK_AI_REVIEW_REQUESTED)`. Idempotent: re-checks task status before running.
- **Notification types:**
  - [`task_reviewer_review_assigned`](../notifications/notifications-admin-events-api-specs.md) — sent to reviewers and the arbiter when they are picked up.
  - [`consultant_task_status_changed`](../../consultant/notifications/notifications-consultant-events-api-specs.md) — sent to the consultant on `done` (with `earned_amount`), `revision_requested` (with `feedback_summary`, `revision_count`, `revisions_remaining`), or `pending_approval` on cap-escalation.
- **Repository:** [`TaskReviewRepository`](../../../../src/modules/unit-of-work/repositories/tasks/task-review.repository.ts) — owns the pessimistic-write lock, the unique constraint check, and the tally aggregation.
- **Consultant submit-for-review:** [tasks-api-specs.md § 4](../../consultant/projects/tasks-api-specs.md#4-submit-task-for-review) — the trigger that enrols the task into this controller's flow.
- **AI gate (stub):** Returns `pass` unconditionally today. The real LLM / plagiarism integration is a follow-up; the contract on `IAiQualityCheckService` is stable and the FE can already differentiate `done` vs `revision_requested` outcomes via the consultant notification.
