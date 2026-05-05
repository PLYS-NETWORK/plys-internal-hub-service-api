# AI Chat — Frontend Integration Guide

> **Audience:** the FE BFF (Next.js server) and the React app it serves.
>
> **Scope:** the two end-user flows for the AI-assisted project planner — **Create** (new project from scratch) and **Update** (existing project; refine or extend). Both flows share the same persistence model, the same chat session machinery, and the same "implement plan" finisher.
>
> **Companion specs:**
>
> - [ai-bootstrap](../api-specs/ai-chat/ai-bootstrap-api-specs.md) — single read on chat open
> - [chat-sessions](../api-specs/ai-chat/chat-sessions-api-specs.md) — sessions + messages
> - [ai-context](../api-specs/ai-chat/ai-context-api-specs.md) — derived AI memory
> - [ai-provider-keys](../api-specs/ai-chat/ai-provider-keys-api-specs.md) — model keys (BFF only)
> - [ai-sync](../api-specs/business-projects/ai-sync-api-specs.md) — atomic-batch apply
> - [projects](../api-specs/business-projects/projects-api-specs.md) — `POST /projects/business`, `PATCH /status`
> - [shared/idempotency](../api-specs/shared/idempotency.md) — `Idempotency-Key` header
>
> **AI implementation note:** the BE never calls a model. The FE BFF (Next.js server) holds the plaintext key in process memory and drives every model interaction. Browsers never see the key.

## Architectural overview

```
┌────────────┐   bootstrap / sessions / messages    ┌──────────┐
│  Browser   │ ───────────────────────────────────► │  Gateway │  Postgres
│  (React)   │ ◄─────────────────────────────────── │  (Nest)  │ ─────────
└─────┬──────┘                                       └────┬─────┘
      │ chat tokens                                         │
      ▼                                                     │
┌────────────┐   GET /ai-provider-keys/active               │
│  FE BFF    │ ──────────────────────────────────────────► (gateway)
│ (Next.js)  │ ◄─────────────  encrypted key envelope ─────┘
│            │   decrypt with FE_BFF_SECRET
│            │   call provider SDK directly
└────────────┘
```

- **Browser ↔ FE BFF:** the streaming chat surface. The BFF is the only component that sees the plaintext model key.
- **FE BFF ↔ Gateway:** persistence + orchestration. Browsers can talk to the gateway directly for bootstrap / sessions / ai-sync; only the model-key fetch must go through the BFF.

## Persistence model (recap)

Every conversation is durable. Refresh the page or close the tab — when the user comes back, the FE replays the session as if nothing happened.

- `project_chat_session` (one row per chat session) holds the **session-level state**:
  - `mode` — `PLANNING | REFINE | EXTEND` (drives prompt selection).
  - `stage` — optional FE-driven sub-state (e.g. `ANALYZE`, `TASK_REVIEW`); the BE never inspects it.
  - `draft` — a free-form JSONB blob the FE writes wholesale every PATCH. Use it for the AI-derived task plan, partial inputs, "user has confirmed step N" flags — anything you'd otherwise put in `localStorage`.
  - `message_count` — denormalised counter, capped at 200.
  - `status` — `active | completed | abandoned`.
- `chat_message` (one row per message) holds the **append-only conversation log**:
  - `seq` — per-session monotonic ordinal; the cursor for newest-first pagination.
  - `role` — `user | assistant | tool | system`.
  - `parts` — the Vercel AI SDK `UIMessage.parts` payload, persisted opaquely.
  - `metadata` — optional AI SDK metadata (tool-call IDs, citations, …).
- `project_ai_context` (one row per project) holds the **derived AI memory**:
  - BE-maintained: `task_index[]` (compact task projection), `last_indexed_at`, `needs_reindex`.
  - FE-derived: `domain`, `primary_stack`, `conventions`, `planning_summary`, `refine_summary`, `extend_summary`, `skill_clusters`, per-task `summary`. These are written by the FE via `PATCH /ai-context/derived` after running its derivation pass.
  - `decisions[]` — append-only audit trail (user-logged decisions + every `derived_write`).

### Why this split?

| State                                 | Where                        | Why                                                                             |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| Conversation log                      | `chat_message` rows          | Cheap pagination; index-only scans on `(session_id, seq DESC)`.                 |
| FE working state ("the current plan") | `project_chat_session.draft` | One JSONB per session; cleared / replaced wholesale per PATCH.                  |
| Cross-session memory                  | `project_ai_context`         | Shared across sessions on the same project; survives session completion.        |
| The current task list                 | `tasks` + `task_index`       | Real DB rows are the source of truth; `task_index` is the AI's compressed view. |

## Bootstrap (every chat open)

When the user clicks the AI assistant button on a project, fire a single bootstrap call:

```ts
const res = await fetch(`/api/v1/projects/${projectId}/ai-bootstrap`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { project, context, sessions, live_setting, live_tasks, live_skills, available_skills } = (
  await res.json()
).data;
```

Pick the right path based on what came back:

- `sessions[0]` exists and `status === 'active'` → resume that session (the most-recently-updated active session for this user on this project).
- `sessions` empty or all closed → no active session; new chat (offer to create one in the right mode for the project status).
- `context === null` → no AI context yet; the FE will lazy-create one when it creates the first session (the BE handles that automatically — see [chat-sessions](../api-specs/ai-chat/chat-sessions-api-specs.md) endpoint 2).
- `context.needs_reindex === true` → run the derivation pass after the user has done something (don't block chat open on it). After deriving, POST the result to `PATCH /ai-context/derived`.

## Resuming a session

For a chosen `sessionId`:

```ts
// 1. Cheap meta read — gives you `draft` (the FE working state) without scanning messages.
const meta = await fetch(`/api/v1/chat-sessions/${sessionId}/meta`, /* … */).then(r => r.json());

// 2. Newest 30 messages — index-only scan.
const firstPage = await fetch(
  `/api/v1/chat-sessions/${sessionId}/messages?limit=30`,
  /* … */,
).then(r => r.json());

// 3. Hydrate the AI SDK with the stored `parts` payloads.
//    They're already in UIMessage shape; no re-shaping needed.
const initialMessages = firstPage.data.messages.reverse(); // BE returns newest-first
useChat({ initialMessages, /* … */ });

// 4. Pull older messages on scroll-up:
//    GET /api/v1/chat-sessions/${sessionId}/messages?before=<seq>&limit=30
```

> **Why not a single "give me everything" endpoint?** Sessions can grow to 200 messages. A 30-message page is < 5 KB; a full transcript would be ~50 KB. The split keeps the chat-resume path fast.

## Saving conversation turns

After each AI turn (or each meaningful user input), patch the session:

```ts
await fetch(`/api/v1/chat-sessions/${sessionId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    append_messages: [
      { role: 'user', parts: [...], metadata: null },
      { role: 'assistant', parts: [...], metadata: null },
    ],
    draft: { /* the current FE working state — replaces any prior draft */ },
    stage: 'TASK_REVIEW' /* optional FE sub-state */,
  }),
});
```

- `append_messages` is **strictly additive** — the BE allocates `seq` ordinals and never re-orders rows. Order in the array = chronological order.
- `draft` is **last-write-wins**. Send the full FE working state every patch — don't try to merge server-side; the BE doesn't read it.
- `stage` is `null` to clear, `undefined` (omit) to leave unchanged.
- The endpoint is **rate-limited at 30 req/min/caller**. One patch per AI turn fits comfortably.

### Common pitfalls

| Symptom                                               | Cause                                        | Fix                                                                                            |
| ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `429 Too Many Requests` on `PATCH /chat-sessions/:id` | Streaming chat patches on every token        | Patch once per turn, after `onFinish` from the AI SDK.                                         |
| `413 CHAT_SESSION_MESSAGE_LIMIT_EXCEEDED`             | Session crossed 200 messages                 | Mark the session `completed` (or `abandoned`), start a new one. The transcript stays readable. |
| `409 CHAT_SESSION_NOT_ACTIVE`                         | Patch issued after the session was completed | The FE didn't update its in-memory status; refetch meta and switch to a new session.           |

## Create flow (new project from scratch)

### Sequence diagram

```
Browser ─┐
         │  Step 1: User clicks "Create with AI"
         ▼
Browser ─► POST /projects/business { code, title, introduction } [Idempotency-Key]
         ◄─ 201 { id, status: "draft", … }
         ─► GET /projects/:id/ai-bootstrap
         ◄─ 200 { project, context: null, sessions: [], live_tasks: [], … }
         ─► POST /projects/:id/chat-sessions { mode: "PLANNING", title: "Initial planning" }
         ◄─ 201 { id: sessionId, draft: {}, … }   ← lazy-creates project_ai_context

         (chat loop — see "Saving conversation turns")
         …
         ─► PATCH /chat-sessions/:sessionId        (per AI turn)

         Step 5–6: AI generates tasks; user reviews / edits.
         The FE keeps the proposed task list in `session.draft`.

         Step 7: User clicks "Implement plan".
         FE re-checks every draft task locally for `price > 0`. If any fails,
         show them inline and disable the button.

         When the user confirms:
         ─► POST /projects/:id/ai-sync/skills    { skill_ids: […] } [Idempotency-Key]
         ◄─ 200 (project status updates)
         ─► POST /projects/:id/ai-sync/settings  { max_consultants, title?, introduction? } [Idempotency-Key]
         ◄─ 200
         ─► POST /projects/:id/ai-sync/tasks     { tasks: [{ action: "create", … }] } [Idempotency-Key]
         ◄─ 200 { results: [{ client_temp_id, status: "created", task_id }], project_status }

         Step 7 (server-side check): the BE ran the price gate inside the
         apply via /ai-sync/tasks (each create row supplies a price > 0).
         If you also want to STAMP the project as configured explicitly:
         ─► PATCH /projects/business/:id/status  { status: "configured" } [Idempotency-Key]
         ◄─ 200, OR 409 PROJECT_PRICE_GATE_FAILED with offending_task_ids

         Step 8: Mark the session done.
         ─► PATCH /chat-sessions/:sessionId/status
            { status: "completed", created_task_ids: [task_id, …] }
         ◄─ 200
```

### Step-by-step (matches the product spec)

1. **Open create dialog.** Collect `code`, `title`, `introduction` (TipTap doc) from the user.
2. **Create the project (status=draft).**
   ```ts
   const res = await fetch('/api/v1/projects/business', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       Authorization: `Bearer ${token}`,
       'Idempotency-Key': crypto.randomUUID(),
     },
     body: JSON.stringify({ code, title, introduction }),
   });
   const { id: projectId } = (await res.json()).data;
   ```
3. **Open the AI chat panel.** Fire `GET /projects/:id/ai-bootstrap` — `context` will be `null` since no chat exists yet.
4. **Create a PLANNING session.** `POST /projects/:id/chat-sessions { mode: 'PLANNING', title: 'Initial planning' }`. The BE lazy-creates `project_ai_context` in the same transaction.
5. **AI analyses the project.** The FE prompt template uses `project.title` + `project.introduction` to infer the domain. The AI's first turn writes `parts` like `{ type: 'text', text: '…domain inference…' }` plus an internal "domain" tool call the FE can persist into `session.draft`.
6. **AI gathers requirements.** Several turns to learn `max_consultants`, required skills, and enough context for tasks. After each turn, `PATCH /chat-sessions/:id` to persist messages + the evolving `draft` (e.g. `draft.proposed_tasks`, `draft.required_skills`, `draft.max_consultants`).
7. **AI generates tasks.** When the AI emits the final task list, store it in `session.draft.proposed_tasks` and render the review UI. Let the user edit / delete / add via the same chat or dedicated edit affordances.
8. **Pre-flight price check.** Before enabling the "Implement plan" button, walk `draft.proposed_tasks` locally:
   ```ts
   const offending = draft.proposed_tasks.filter((t) => Number(t.price) <= 0);
   if (offending.length > 0) {
     // Highlight them inline; keep the button disabled.
   }
   ```
   Server-side, `POST /ai-sync/tasks` will also reject zero-priced rows via `AI_SYNC_TASK_REJECTED` (pre-row validation), and `PATCH /projects/:id/status` will reject via `PROJECT_PRICE_GATE_FAILED` — but checking client-side keeps the UX tight.
9. **Implement plan (atomic-batch apply).** Three calls, each with its own `Idempotency-Key`:
   ```ts
   await postAiSync('/skills', { skill_ids: draft.required_skills });
   await postAiSync('/settings', { max_consultants: draft.max_consultants });
   const tasksRes = await postAiSync('/tasks', {
     tasks: draft.proposed_tasks.map((t, i) => ({
       client_temp_id: `tmp-${i}`,
       action: 'create',
       title: t.title,
       description: t.description,
       price: t.price,
     })),
   });
   const createdTaskIds = tasksRes.data.results.map((r) => r.task_id);
   ```
   The order matters only because **skills + settings must run before the price gate** (the auto-recompute uses both signals). After all three, the project is at `configured` automatically.
10. **Mark the session completed.** `PATCH /chat-sessions/:id/status { status: 'completed', created_task_ids }`. The transcript stays readable in the picker; future sessions on the same project see it as historical context.
11. **(Optional) Run derivation + write back.** If `bootstrap.context.needs_reindex === true` after the apply, run the FE derivation pass over the new `task_index`, then `PATCH /ai-context/derived` with `{ domain, conventions, planning_summary, task_summaries: [{ task_id, summary }, …] }`. The BE clears `needs_reindex` and stamps `last_indexed_at`.

## Update flow (existing project)

Mode + permitted actions depend on the project status:

| Project status              | Mode the FE picks      | What the AI is allowed to do                                                             |
| --------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `draft`                     | `PLANNING` or `REFINE` | Continue planning. Any draft-task action via AI-sync.                                    |
| `configured`                | `REFINE`               | Create / update / delete draft tasks + settings + skills.                                |
| `published` / `in_progress` | `EXTEND`               | **Create-only.** Update / delete of existing tasks is rejected by the AI-sync whitelist. |

Detect the right mode from `bootstrap.project.status`:

```ts
function pickMode(status: ProjectStatus): ChatSessionMode {
  if (status === 'draft') return 'PLANNING';
  if (status === 'configured') return 'REFINE';
  return 'EXTEND'; // published / in_progress
}
```

### Step-by-step

1. **User opens the project detail page.**
2. **User clicks the AI assistant icon.** Fire `GET /projects/:id/ai-bootstrap`.
3. **Resume or create a session.**
   - If `bootstrap.sessions[0]?.status === 'active'`, resume it (the most-recent active session for this user/project).
   - Otherwise, `POST /projects/:id/chat-sessions { mode: pickMode(bootstrap.project.status), title }`.
4. **Pre-load conversation context for the AI prompt.** The chat prompt should include:
   - The right `*_summary` from `context` (`planning_summary` for PLANNING/REFINE, `extend_summary` for EXTEND, etc.).
   - `context.domain`, `context.conventions`, `context.task_index` — give the AI the compressed task list, not the raw task rows.
   - The last decisions (`context.decisions.filter(d => d.source !== 'derived_write').slice(-10)`).
   - The current chat history (newest 30 messages; load older on demand).
5. **Run the chat loop.** Same pattern as create flow — `PATCH /chat-sessions/:id` per turn with `append_messages` + the evolving `draft`.
6. **Ask the AI for the requested change.**
   - **3.1 (draft):** AI continues planning; same as create flow from step 5 onwards.
   - **3.2 (configured):** AI offers create / update / delete on draft tasks, settings, or skills. Build a plan in `session.draft.pending_changes` and let the user review.
   - **3.3 (published / in_progress):** AI offers **only** new task creation (created tasks land as `draft` so they don't enter the consultant queue until the business reviews them) and settings updates.
7. **Pre-flight price check.** Same as create flow — walk every `action: 'create'` row, ensure `price > 0`. Don't enable the "Implement plan" button until clean.
8. **Apply the plan.** Use whichever AI-sync endpoints the change requires:
   - Tasks change → `POST /ai-sync/tasks` (mode-aware whitelist; the BE 422s with `offending_client_temp_ids` if anything violates it).
   - Settings change → `POST /ai-sync/settings`.
   - Skills change → `POST /ai-sync/skills`.
     Each call carries its own `Idempotency-Key`. Treat `AI_SYNC_TASK_REJECTED` 422 as a "the FE prompt produced an illegal plan for this project status" bug — log and surface to the user, don't silently retry.
9. **Mark the session completed** with `created_task_ids` populated.
10. **(Optional) Re-derive context** if `needs_reindex` is true after the apply; `PATCH /ai-context/derived`.

## Performance + UX best practices

### On the FE

- **Stream the assistant turn immediately**, then `PATCH /chat-sessions/:id` once on `onFinish` with the final `parts` array. Don't patch on every token — you'll burn the rate limit and the BE's 200-message ceiling.
- **Persist `draft` opportunistically**, not on every keystroke. A patch per AI turn or per meaningful user input is fine; debouncing 1–2s is fine.
- **Keep the in-memory `draft` authoritative** between patches. The BE never reads it during the session — your local copy IS the working state. The patch just snapshots it.
- **Paginate messages on scroll-up**, never on chat open. The first page (newest 30) is always enough to render the visible viewport.
- **Cache `available_skills` from the bootstrap** for the chat session lifetime. It's the global skill catalog; refetch on next chat open.
- **Run derivation in the background**, not on chat open. If `needs_reindex === true`, kick off derivation after the user has interacted at least once.

### On the FE BFF (Next.js server)

- **Cache the decrypted model key in process memory** until `expires_at` from `GET /ai-provider-keys/active`. Don't refetch per request.
- **Never log the plaintext key.** Log `key_last4` if you need a correlation handle.
- **Handle 404 `AI_PROVIDER_KEY_NOT_CONFIGURED`** by showing the user "AI chat unavailable — contact admin" rather than crashing the BFF.

### Idempotent retries

Every mutation endpoint that opts into idempotency is documented in [shared/idempotency](../api-specs/shared/idempotency.md). Pattern:

```ts
async function postWithRetry(url: string, body: unknown) {
  const idempotencyKey = crypto.randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey, // SAME key across retries
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (res.status >= 500) {
      await sleep(2 ** attempt * 1000);
      continue;
    }
    throw await toError(res);
  }
  throw new Error('Exhausted retries');
}
```

The same `Idempotency-Key` across attempts means: first success commits and is replayed on retry. A different key = a different logical request, even if the body matches.

### Pre-flight price gate (canonical client implementation)

```ts
function findZeroPricedDrafts(
  tasks: Array<{ price: string; id?: string; client_temp_id?: string }>,
) {
  return tasks
    .filter((t) => Number(t.price) <= 0)
    .map((t) => ({ id: t.id, tempId: t.client_temp_id, price: t.price }));
}

// Usage:
const offenders = findZeroPricedDrafts(draft.proposed_tasks);
if (offenders.length > 0) {
  showInlineError('These tasks need a price before you can implement the plan:', offenders);
  return; // keep the button disabled
}
```

## Error handling cheatsheet

| Scenario                                                             | HTTP | error_code                            | Meaning                                                         |
| -------------------------------------------------------------------- | ---- | ------------------------------------- | --------------------------------------------------------------- |
| Trying to chat in EXTEND mode on a `done` project                    | 409  | `CHAT_SESSION_MODE_NOT_ALLOWED`       | Project is in a terminal status. Show "this project is closed". |
| Patching a closed session                                            | 409  | `CHAT_SESSION_NOT_ACTIVE`             | Refresh; the user closed the session in another tab.            |
| Patch crosses 200 messages                                           | 413  | `CHAT_SESSION_MESSAGE_LIMIT_EXCEEDED` | Mark current session completed; offer "start a new session".    |
| User submitted an HTML/script payload via the FE-derived endpoint    | 422  | `AI_CONTEXT_DERIVED_HTML_FORBIDDEN`   | The FE derivation produced markup; fix the prompt template.     |
| AI plan rejected because a row violated the project-status whitelist | 422  | `AI_SYNC_TASK_REJECTED`               | `data.offending_client_temp_ids` lists offenders.               |
| AI plan rejected because a row referenced an unknown skill           | 422  | `PROJECT_SKILL_NOT_FOUND`             | Re-fetch `available_skills`; the catalog changed.               |
| Manual transition rejected because of $0 tasks                       | 409  | `PROJECT_PRICE_GATE_FAILED`           | `data.offending_task_ids` lists offenders.                      |
| Same `Idempotency-Key` reused with new body                          | 409  | `IDEMPOTENCY_KEY_BODY_MISMATCH`       | Bug — generate a new key for new logical requests.              |
| 30 patches in 1 minute                                               | 429  | `AUTH_RATE_LIMITED`                   | Back off; reduce per-token patches to per-turn.                 |

## Out of scope for this guide

- **Streaming UX** — use the AI SDK's `useChat` hook directly; the BE persistence model is orthogonal to streaming.
- **Tool calls** — the BE persists `parts` opaquely; tool-call serialisation is the AI SDK's concern.
- **Cost tracking** — billing is a future concern; the current vault stores the active key but doesn't aggregate token usage.
