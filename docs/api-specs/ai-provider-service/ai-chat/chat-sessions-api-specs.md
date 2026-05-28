# Chat Sessions — API Specs

> **Sources:**
>
> - Project-scoped: [apps/ai-provider-service/src/modules/project-chat-session/controllers/project-sessions.controller.ts](../../../../apps/ai-provider-service/src/modules/project-chat-session/controllers/project-sessions.controller.ts)
> - Session-scoped: [apps/ai-provider-service/src/modules/project-chat-session/controllers/chat-sessions.controller.ts](../../../../apps/ai-provider-service/src/modules/project-chat-session/controllers/chat-sessions.controller.ts)
>
> **Scope:** Bearer auth, `@Roles(USER)`, `@Platform(BUSINESS)` — global guards.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.
> **Persistence model:** chat sessions are stored in `project_chat_session` (one row per session); messages are stored append-only in `chat_message` (one row per message, paginated by per-session monotonic `seq` cursor — see schema in [migration 20260506000003](../../../../apps/ai-provider-service/src/database/migrations/20260506000003-AddChatAndAiContextSchema.ts)).

## Cross-cutting errors

| HTTP | error_code                   | When                                                                                                                                  |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`          | Missing/invalid Bearer token.                                                                                                         |
| 403  | `BUSINESS_PROFILE_NOT_FOUND` | Caller has no active business profile (project-scoped routes only).                                                                   |
| 404  | `PROJECT_NOT_FOUND`          | Project not owned by caller (project-scoped routes only).                                                                             |
| 404  | `CHAT_SESSION_NOT_FOUND`     | Session does not exist OR not owned by the calling user — session-scoped routes return 404 to avoid leaking existence across tenants. |

## Project-scoped endpoints

### 1. List the calling user's chat sessions on a project

- **Endpoint:** `GET /projects/:projectId/chat-sessions`
- **Method:** `GET`
- **Path params:** `projectId` (UUID v4)
- **Behaviour:** Returns sessions ordered by `updated_at DESC`. Excludes message bodies and the `draft` JSONB to keep the picker payload small.
- **Response 200:** [`IChatSessionListItemResponse[]`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/responses/interfaces/chat-session.response.interface.ts) — array.
- **Errors:** cross-cutting only.

```jsonc
[
  {
    "id": "uuid",
    "mode": "PLANNING",
    "stage": null,
    "title": "Initial planning",
    "status": "active",
    "message_count": 24,
    "implemented_at": null,
    "created_task_ids": null,
    "created_at": "2026-05-04T10:00:00.000Z",
    "updated_at": "2026-05-05T15:30:00.000Z",
  },
]
```

### 2. Create a new chat session on a project

- **Endpoint:** `POST /projects/:projectId/chat-sessions`
- **Method:** `POST`
- **Path params:** `projectId` (UUID v4)
- **Request body:** [`ICreateSessionRequest`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/requests/interfaces/create-session.request.interface.ts)
  | Field | Type | Required | Notes |
  | ------- | ------------------------------------------ | -------- | ----- |
  | `mode` | `'PLANNING' \| 'REFINE' \| 'EXTEND'` | yes | Determines which prompt template the FE selects. |
  | `title` | `string` | yes | length 1–160; shown in the picker. |
- **Side effect:** lazily creates the `project_ai_context` row in the same transaction via [`ProjectAiContextService.ensureExists`](../../../../apps/ai-provider-service/src/modules/project-ai-context/project-ai-context.service.ts) so a session never exists without its context.
- **Mode-status compatibility (advisory):** the BE rejects only on terminal statuses; non-terminal statuses are permissive so the FE can choose the prompt template freely. The full table:

  | Project status       | Allowed modes                  | Notes                                  |
  | -------------------- | ------------------------------ | -------------------------------------- |
  | `draft`              | `PLANNING`, `REFINE`           | `EXTEND` rejected — nothing to extend. |
  | `configured`         | `PLANNING`, `REFINE`, `EXTEND` | All allowed.                           |
  | `published`          | `PLANNING`, `REFINE`, `EXTEND` | All allowed.                           |
  | `in_progress`        | `PLANNING`, `REFINE`, `EXTEND` | All allowed.                           |
  | `done` / `cancelled` | none                           | All modes rejected.                    |

- **Response 201:** [`IChatSessionMetaResponse`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/responses/interfaces/chat-session.response.interface.ts) — full meta + empty `draft: {}`.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 409 | `CHAT_SESSION_MODE_NOT_ALLOWED` | Mode rejected by the table above. `args` carries `{ status, mode }`. |

## Session-scoped endpoints

These routes are mounted under `/chat-sessions/:sessionId/*`. Ownership is checked inside the service: rows must match `(id, user_id)` from the request context, otherwise `404 CHAT_SESSION_NOT_FOUND`.

### 3. Get a session's metadata + draft (no messages)

- **Endpoint:** `GET /chat-sessions/:sessionId/meta`
- **Method:** `GET`
- **Path params:** `sessionId` (UUID v4)
- **Behaviour:** Returns the row with `draft` populated. Fetch this when resuming a session — it's cheap (no message scan).
- **Response 200:** [`IChatSessionMetaResponse`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/responses/interfaces/chat-session.response.interface.ts).
- **Errors:** cross-cutting only.

### 4. Append messages and/or update the session draft / stage

- **Endpoint:** `PATCH /chat-sessions/:sessionId`
- **Method:** `PATCH`
- **Throttle:** 30 requests/min/caller (`@Throttle({ default: { limit: 30, ttl: 60_000 } })`). Above the cap → `429 Too Many Requests`.
- **Request body:** [`IPatchSessionRequest`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/requests/interfaces/append-message.request.interface.ts) — every field optional; "no fields provided" is a no-op patch (touches `updated_at`).
  | Field | Type | Required | Notes |
  | ----------------- | ---------------------------------------- | -------- | ----- |
  | `append_messages` | `IAppendMessageRequest[]` | no | size 0–50 per call; appended in order. Each message: `{ role, parts, metadata? }`. `role` ∈ `user | assistant | tool | system`. `parts` is the Vercel AI SDK `UIMessage.parts` shape — opaque to the BE. |
  | `draft` | `Record<string, unknown>` | no | Replaces the session-level draft state in full (last-write-wins). |
  | `stage` | `string \| null` | no | Optional FE-driven sub-state (PLANNING flow only). `null` clears it; omit to leave unchanged. |
- **Behaviour (single transaction):**
  1. Locks the session row (`pessimistic_write`) so concurrent appends from two devices serialise.
  2. Rejects if `session.status !== 'active'`.
  3. Computes `newCount = message_count + append_messages.length` and rejects with 413 if it would exceed `200`.
  4. Allocates per-session monotonic `seq` ordinals starting at `message_count + 1` and inserts every message in one statement.
  5. If `draft !== undefined` replaces it; if `stage !== undefined` updates it.
  6. Saves the session row (touches `updated_at`).
- **Response 200:** [`IPatchSessionResponse`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/responses/interfaces/chat-session.response.interface.ts) — `{ id, message_count, updated_at }`. Minimal echo so the FE can patch its in-memory state without re-reading.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 409 | `CHAT_SESSION_NOT_ACTIVE` | Session is `completed` or `abandoned`. |
  | 413 | `CHAT_SESSION_MESSAGE_LIMIT_EXCEEDED` | Append would exceed the 200-message cap; start a new session. |
  | 429 | `AUTH_RATE_LIMITED` | Throttle exceeded. |

### 5. Paginated message list (newest-first by `seq`)

- **Endpoint:** `GET /chat-sessions/:sessionId/messages`
- **Method:** `GET`
- **Query params:** [`IListMessagesRequest`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/requests/interfaces/list-messages.request.interface.ts)
  | Field | Type | Required | Notes |
  | -------- | -------- | -------- | ----- |
  | `before` | `number` | no | Cursor: returns rows with `seq < before`, newest-first. Omit on the first page. |
  | `limit` | `number` | no | default 30, max 100. |
- **Behaviour:** Index-only scan on `idx_chat_message_session_seq_desc` (`(session_id, seq DESC)`). Cursor is `seq` rather than `created_at` to avoid millisecond-tie ambiguity.
- **Response 200:** [`IChatMessagePageResponse`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/responses/interfaces/chat-message.response.interface.ts) — `{ messages: IChatMessageResponse[], next_cursor: number | null }`. `next_cursor` is the `seq` of the oldest row in this page; pass it as `before` to advance. `null` when exhausted.
- **Errors:** cross-cutting only.

```jsonc
{
  "messages": [
    {
      "id": "uuid",
      "seq": 24,
      "role": "assistant",
      "parts": [
        /* AI SDK UIMessage parts */
      ],
      "metadata": null,
      "created_at": "2026-05-05T15:30:00.000Z",
    },
  ],
  "next_cursor": 23 /* or null when there are no older messages */,
}
```

### 6. Mark a session `completed` or `abandoned`

- **Endpoint:** `PATCH /chat-sessions/:sessionId/status`
- **Method:** `PATCH`
- **Request body:** [`IUpdateSessionStatusRequest`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/requests/interfaces/update-session-status.request.interface.ts)
  | Field | Type | Required | Notes |
  | ------------------ | ----------------------------- | -------- | ----- |
  | `status` | `'completed' \| 'abandoned'` | yes | `'active'` is intentionally not accepted — closed sessions are read-only. |
  | `created_task_ids` | `string[]` (UUID v4) | no | Audit-only; populated by the FE after `POST /ai-sync/tasks` returns. Stored on the session for forensic / replay use. Cap 200. |
- **Behaviour (single transaction):** locks the session row, rejects with `409 CHAT_SESSION_NOT_ACTIVE` if the row isn't currently active (so audit fields aren't overwritten), sets `status`, stamps `implemented_at = now()` on `completed`, persists `created_task_ids` if provided.
- **Response 200:** [`IChatSessionMetaResponse`](../../../../apps/ai-provider-service/src/modules/project-chat-session/dto/responses/interfaces/chat-session.response.interface.ts).
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 409 | `CHAT_SESSION_NOT_ACTIVE` | Session is already `completed` or `abandoned`. |

## Persistence + resumption notes

- One row per session in `project_chat_session`. The picker shows every session for `(project_id, user_id)`. Multiple concurrent sessions per (project, user) are allowed — there is no UNIQUE constraint on the pair.
- Messages live in `chat_message` rows, never in JSONB on the session — `GET /messages` is an index-only scan regardless of conversation length.
- The session's `draft` JSONB is the FE's working state (current AI-derived task plan, partial inputs, …). It is replaced wholesale on `PATCH /chat-sessions/:id` and is never read by the BE; treat it as a private FE blob persisted server-side.
- Daily housekeeping cron auto-marks sessions `abandoned` if `status='active'` AND `updated_at < now() - 90 days` AND `message_count < 5`. Long-running sessions with real history stay active.
