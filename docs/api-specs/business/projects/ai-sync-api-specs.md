# AiSyncController — API Specs

> **Source:** [src/modules/business-projects/controllers/ai-sync.controller.ts](../../../../src/modules/business-projects/controllers/ai-sync.controller.ts)
> **Base path:** `/projects/business/:id/ai-sync`
> **Scope:** Bearer auth, `@Roles(USER)`, `@Platform(BUSINESS)`.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.

These three endpoints are the AI implementation runner's "apply the plan" surface. Each call is wrapped in a single transaction inside the relevant service method, and every endpoint opts into idempotent replay via `Idempotency-Key` (see [shared idempotency note](../../shared/idempotency-api-specs.md)) so the FE's retry logic can hit the same key after a network blip without applying the plan twice.

The per-resource endpoints in [backlogs](./backlogs-api-specs.md) and [settings](./settings-api-specs.md) remain available — they're the "edit one task in the UI" flow. The AI runner uses these batch endpoints because:

- One transaction per apply — atomicity matters; partial application produces a half-implemented plan the user can't reconcile.
- One idempotency key per apply — retries cover the whole batch.
- Single AI-context reindex enqueue at the end — debouncing across a 50-row burst keeps the FE's derivation loop tight.
- Mode validation runs once on `project.status` rather than on every per-row call.

## Cross-cutting errors

| HTTP | error_code                                    | When                                                            |
| ---- | --------------------------------------------- | --------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`                           | Missing/invalid Bearer token.                                   |
| 403  | `BUSINESS_PROFILE_NOT_FOUND`                  | Caller has no active business profile.                          |
| 403  | `PROJECT_FORBIDDEN` / 404 `PROJECT_NOT_FOUND` | Project not owned by the caller.                                |
| 409  | `IDEMPOTENCY_KEY_BODY_MISMATCH`               | `Idempotency-Key` reused with a different body.                 |
| 422  | (validation)                                  | DTO shape failures (UUID, length, JSON size, action whitelist). |

## Endpoints

### 1. AI-sync atomic settings save

- **Endpoint:** `POST /projects/business/:id/ai-sync/settings`
- **Method:** `POST`
- **Idempotency:** `Idempotency-Key` request header.
- **Path params:** `id` (UUID v4)
- **Request body:** [`AiSyncSettingsDto`](../../../../src/modules/business-projects/dto/requests/ai-sync-settings.dto.ts) — every field optional.
  | Field | Type | Required | Notes |
  | ----------------- | ------------------------------------------ | -------- | ----- |
  | `title` | `string` | no | length 3–300. |
  | `introduction` | `Record<string, unknown> \| null` | no | TipTap doc. JSON-encoded payload capped at 50 KB; `null` clears it. |
  | `max_consultants` | `number` | no | integer 0–10. Setting `0` demotes a configured project back to `draft` via the auto-status recompute. |
- **Behaviour (single transaction):**
  1. Resolves project ownership.
  2. Asserts the project is editable (rejects `done` / `cancelled` with `422 PROJECT_CANNOT_BE_EDITED`).
  3. Applies whichever fields are provided.
  4. Recomputes auto-status (drafts > 0 ∧ skills > 0 ∧ consultants > 0 → `configured`; otherwise `draft`).
- **Response 200:** [`IProjectSummaryResponse`](../../../../src/modules/business-projects/dto/responses/interfaces/project-summary.response.interface.ts) — final project metadata + post-recompute `status`.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 422 | `PROJECT_CANNOT_BE_EDITED` | Project is `done` or `cancelled`. |

### 2. AI-sync replace-set required skills

- **Endpoint:** `POST /projects/business/:id/ai-sync/skills`
- **Method:** `POST`
- **Idempotency:** `Idempotency-Key` request header.
- **Path params:** `id` (UUID v4)
- **Request body:** [`AiSyncSkillsDto`](../../../../src/modules/business-projects/dto/requests/ai-sync-skills.dto.ts)
  | Field | Type | Required | Notes |
  | ----------- | --------------------- | -------- | ----- |
  | `skill_ids` | `string[]` (UUID v4) | yes | size 0–20; deduplicated. Empty array allowed (clears all required skills). |
- **Behaviour (single transaction):**
  1. Resolves project ownership; asserts editable.
  2. Validates every UUID exists in `skills` — rejects with 422 `PROJECT_SKILL_NOT_FOUND` if any unknown.
  3. Hard-deletes all existing rows from `project_required_skill` for the project, then inserts the new set.
  4. Lazy-creates the `project_ai_context` row and flips `needs_reindex = true` so the FE re-derives skill clusters on next bootstrap.
  5. Recomputes auto-status.
- **Response 200:** [`IProjectSummaryResponse`](../../../../src/modules/business-projects/dto/responses/interfaces/project-summary.response.interface.ts).
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 422 | `PROJECT_SKILL_NOT_FOUND` | One or more skill IDs do not exist in the catalog. |
  | 422 | `PROJECT_CANNOT_BE_EDITED` | Project is `done` or `cancelled`. |

### 3. AI-sync atomic batch task create / update / delete

- **Endpoint:** `POST /projects/business/:id/ai-sync/tasks`
- **Method:** `POST`
- **Idempotency:** `Idempotency-Key` request header.
- **Path params:** `id` (UUID v4)
- **Request body:** [`AiSyncTasksDto`](../../../../src/modules/business-projects/dto/requests/ai-sync-tasks.dto.ts) — `{ tasks: AiSyncTaskRowDto[] }` size 1–50.
  Per-row [`AiSyncTaskRowDto`](../../../../src/modules/business-projects/dto/requests/ai-sync-tasks.dto.ts):
  | Field | Type | Required | Notes |
  | ---------------- | ------------------------------------------ | -------- | ----- |
  | `client_temp_id` | `string` | no | length 1–80. FE-supplied correlation id, echoed back in the per-row response. |
  | `action` | `'create' \| 'update' \| 'delete'` | yes | |
  | `task_id` | `string` (UUID v4) | conditional | required for `update` / `delete`; **forbidden** on `create`. |
  | `title` | `string` | conditional | required on `create`; length 3–300. |
  | `description` | `Record<string, unknown> \| null` | no | TipTap doc. JSON-encoded payload capped at 50 KB. |
  | `price` | `string` | no | decimal-safe string. Optional on `create` (defaults to `'0'`); optional on `update` (leaves the price unchanged when omitted). |

- **Mode-aware action whitelist (advisory):**

  | Project status       | Allowed actions              | Notes                                                                 |
  | -------------------- | ---------------------------- | --------------------------------------------------------------------- |
  | `draft`              | `create`, `update`, `delete` | Full plan rebuild.                                                    |
  | `configured`         | `create`, `update`, `delete` | Same as `draft`; project status doesn't reset.                        |
  | `published`          | `create`                     | EXTEND mode — only new draft tasks; existing tasks are out of bounds. |
  | `in_progress`        | `create`                     | Same as `published`.                                                  |
  | `done` / `cancelled` | none                         | Every action rejected.                                                |

- **Behaviour (single transaction, all-or-nothing):**
  1. Resolves project ownership.
  2. Validates every row up-front against the whitelist + per-row field rules. **Any single offender fails the whole batch** with 422; no rows applied.
  3. Applies in fixed order — deletes → updates → creates — so display_order allocation for creates uses the post-delete max:
     - `delete`: asserts every target task is `kanban_status = 'draft'`, hard-deletes the rows, removes them from `task_index`.
     - `update`: re-loads each task under the same tx (DRAFT-only); applies title/description/price; light AI-context patch. Missing rows cause the whole batch to fail with `404 TASK_NOT_FOUND`.
     - `create`: allocates `code` via `tx.taskCodes.next` and `display_order = max + i`. `creation_mode` is set to `ai_assisted`. `kanban_status = 'draft'`. Light AI-context patch.
  4. Recomputes auto-status.
- **Response 200:** [`AiSyncTasksResponseDto`](../../../../src/modules/business-projects/dto/responses/ai-sync-tasks-response.dto.ts) — `{ results: AiSyncTaskResultDto[], project_status: ProjectStatus }`. Per-row result: `{ client_temp_id, status: 'created' | 'updated' | 'deleted', task_id }`.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 404 | `TASK_NOT_FOUND` | An `update` / `delete` row references a task that's missing or no longer DRAFT. The whole batch rolls back. `args.task_id` carries the offending UUID. |
  | 422 | `AI_SYNC_TASK_REJECTED` | One or more rows violated the action whitelist or per-row field rules. **`details: { offending_client_temp_ids: string[] }`** lists the offenders so the FE can surface them. |

```jsonc
// Example success response
{
  "results": [
    { "client_temp_id": "tmp-01", "status": "created", "task_id": "uuid-new" },
    { "client_temp_id": "tmp-02", "status": "updated", "task_id": "uuid-existing" },
    { "client_temp_id": "tmp-03", "status": "deleted", "task_id": "uuid-existing" },
  ],
  "project_status": "configured",
}
```

```jsonc
// Example 422 (offending rows)
{
  "status_code": 422,
  "error_code": "AI_SYNC_TASK_REJECTED",
  "message": "One or more tasks in the batch could not be applied for the project's current status.",
  "data": {
    "offending_client_temp_ids": ["tmp-04", "tmp-07"],
  },
  "timestamp": "2026-05-05T16:00:00.000Z",
  "path": "/projects/business/<uuid>/ai-sync/tasks",
}
```

## Side effects shared by all three endpoints

- The `project_ai_context.task_index` is patched implicitly by the same hooks that fire on per-resource task CRUD; the AI-sync batch consolidates them so the FE's bootstrap → derive → write-back loop only fires once per apply.
- `needs_reindex` flips to `true` on any task creation or skill change, signalling the FE to re-derive the AI fields (domain, conventions, summaries) on the next bootstrap and post them via `PATCH /ai-context/derived`.
