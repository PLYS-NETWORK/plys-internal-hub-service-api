# AI Context — API Specs

> **Sources:**
>
> - User-facing: [src/modules/project-ai-context/project-ai-context.controller.ts](../../../../src/modules/project-ai-context/project-ai-context.controller.ts)
> - Admin debug: [src/modules/project-ai-context/project-ai-context-admin.controller.ts](../../../../src/modules/project-ai-context/project-ai-context-admin.controller.ts)
>
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Persistence model:** one row per project in `project_ai_context`. Two slices coexist: BE-maintained (`task_index`, `last_indexed_at`, `task_count_at_index`, `needs_reindex`) and FE-derived (`domain`, `primary_stack`, `conventions`, `*_summary`, `skill_clusters`, per-task `summary`). The BE never derives the FE slice — the FE writes it back via `PATCH /derived` after running its own derivation. See [migration 20260506000003](../../../../src/database/migrations/20260506000003-AddChatAndAiContextSchema.ts).

## Cross-cutting errors

| HTTP | error_code                   | When                                                        |
| ---- | ---------------------------- | ----------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token.                               |
| 403  | `BUSINESS_PROFILE_NOT_FOUND` | Caller has no active business profile (user-facing only).   |
| 404  | `PROJECT_NOT_FOUND`          | Project not owned by the caller (user-facing only).         |
| 422  | (validation)                 | DTO shape failures (length, UUID, JSON size, HTML markers). |

## User-facing endpoints

Mounted under `/projects/:projectId/ai-context`. `@Roles(USER)`, `@Platform(BUSINESS)`. Project ownership is checked inside the service via [`BusinessAccessService.resolveOwnedProject`](../../../../src/modules/business-projects/services/business-access.service.ts).

### 1. Append an audit decision

- **Endpoint:** `POST /projects/:projectId/ai-context/decisions`
- **Method:** `POST`
- **Idempotency:** opt-in via `Idempotency-Key` request header (see [shared idempotency note](../../shared/idempotency-api-specs.md)).
- **Path params:** `projectId` (UUID v4)
- **Request body:** [`ILogDecisionRequest`](../../../../src/modules/project-ai-context/dto/requests/interfaces/log-decision.request.interface.ts)
  | Field | Type | Required | Notes |
  | ----------- | ------------------------------------------ | -------- | ----- |
  | `decision` | `string` | yes | length 1–500. Sanitised (NFC + control-char strip + HTML rejection). |
  | `rationale` | `string` | yes | length 1–2000. Sanitised. |
  | `source` | `'planning' \| 'refine' \| 'extend'` | yes | which planning episode produced the decision. |
- **Behaviour:** lazy-creates the `project_ai_context` row, then appends the audit entry to `decisions[]` in the same transaction. The decision is augmented server-side with `at` (ISO timestamp), `actor_user_id`, and `request_id`. Append-only; never trimmed.
- **Response 200:** [`IAiContextResponse`](../../../../src/modules/project-ai-context/dto/responses/interfaces/ai-context.response.interface.ts) — full updated context row.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 422 | `AI_CONTEXT_DERIVED_HTML_FORBIDDEN` | A `<script>`, `javascript:`, `data:text/html`, or `on…=` event-handler pattern was detected in any sanitised field. |

### 2. Merge FE-derived AI fields back into the context row

- **Endpoint:** `PATCH /projects/:projectId/ai-context/derived`
- **Method:** `PATCH`
- **Path params:** `projectId` (UUID v4)
- **Request body:** [`IUpdateDerivedContextRequest`](../../../../src/modules/project-ai-context/dto/requests/interfaces/update-derived-context.request.interface.ts) — every field optional; whatever the FE sends gets merged.
  | Field | Type | Required | Notes |
  | ------------------ | ------------------------------------------ | -------- | ----- |
  | `domain` | `string` | no | length 1–200. Sanitised. |
  | `primary_stack` | `string[]` | no | size 0–20; each item length 1–60. |
  | `conventions` | `string` | no | length 0–4000. Sanitised. |
  | `planning_summary` | `string` | no | length 0–8000. Sanitised. |
  | `refine_summary` | `string` | no | length 0–8000. Sanitised. |
  | `extend_summary` | `string` | no | length 0–8000. Sanitised. |
  | `skill_clusters` | `Record<string, unknown>` | no | FE-managed map. JSON-encoded payload capped at 16 KB. |
  | `task_summaries` | `{ task_id: UUID, summary: string }[]` | no | size 0–200; per-row `summary` length 1–500, sanitised. Patches matching `task_index[].summary` by `task_id`; rows that don't match are silently skipped (the BE owns the index shape). |
- **Behaviour (single transaction):**
  1. Lazily creates the row if missing.
  2. Merges every provided field (left unset fields keep their value).
  3. For every `task_summaries[]` entry, patches `task_index[].summary` by `task_id`.
  4. Appends a `{ source: 'derived_write', actor_user_id, request_id, fields_changed: [...], at }` audit entry to `decisions[]`.
  5. Sets `needs_reindex = false`, stamps `last_indexed_at = now()`, updates `task_count_at_index = task_index.length`.
- **Sanitisation contract (every freeform string field):**
  1. Unicode NFC normalisation.
  2. Control-char strip (preserves `\t`, `\n`, `\r`).
  3. Outer-whitespace trim.
  4. HTML / scheme rejection: `<script>`, `</script>`, `javascript:`, `data:text/html`, `on…=` event handlers → 422 `AI_CONTEXT_DERIVED_HTML_FORBIDDEN`.
- **Response 200:** [`IAiContextResponse`](../../../../src/modules/project-ai-context/dto/responses/interfaces/ai-context.response.interface.ts).
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 422 | `AI_CONTEXT_DERIVED_HTML_FORBIDDEN` | See sanitisation contract. |

## Admin debug endpoint

Mounted under `/admin/projects/:projectId/ai-context`. `@Roles(ADMIN_PLATFORM)` — no platform constraint.

### 3. Read the full context row (admin only)

- **Endpoint:** `GET /admin/projects/:projectId/ai-context`
- **Method:** `GET`
- **Path params:** `projectId` (UUID v4)
- **Behaviour:** Returns every column including the `decisions` audit array. Used for troubleshooting; the user-facing chat panel reads its slice via `/projects/:projectId/ai-bootstrap`.
- **Response 200:** [`IAiContextResponse`](../../../../src/modules/project-ai-context/dto/responses/interfaces/ai-context.response.interface.ts).
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 404 | `AI_CONTEXT_NOT_FOUND` | No `project_ai_context` row for the given project. |

## Background hooks (no public surface)

The BE-maintained `task_index` is patched implicitly by `BacklogsService` whenever a draft task is created, updated, or deleted (also true for the AI-sync batch endpoints). On insert / delete the hook flips `needs_reindex = true` so the FE knows the AI-derived slice has gone stale; on simple updates it leaves the flag alone (existing summaries stay valid).

A 6-hour repeating cron (`flag-projects-for-reindex` in [HousekeepingProcessor](../../../../src/modules/housekeeping/housekeeping.processor.ts)) flips `needs_reindex = true` on rows whose `last_indexed_at` is older than 7 days — the FE's safety net against forgotten derived-writes.
