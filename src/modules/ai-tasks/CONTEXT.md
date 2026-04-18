# AI Task Sessions — Business Context

## Purpose
Owns the persistent conversation log when a business uses AI assistance to draft tasks. The session lets the business return to an existing chat, ask the AI to revise prior drafts, and audit what was generated.

## Tables owned
- `ai_task_sessions` — chat session header (project, user, optional title, active flag).
- `ai_session_messages` — append-only message history with optional link to the task each message produced.

## Key invariants
- **One active session per (project, user).** Partial unique index on `(project_id, user_id) WHERE is_active = TRUE`. Starting a new session must first set the previous one to `is_active = FALSE`.
- **History is preserved.** Closing a session never deletes messages — only flips `is_active`. Audit queries always include closed sessions.
- **AI-generated tasks start as `kanban_status = draft`.** Invisible to consultants until the business explicitly publishes them (`draft → to_do`).
- **Message order uniqueness.** §M4 — `(session_id, message_order)` is uniquely constrained so two concurrent inserts can't claim the same slot.
- **`linked_task_id` is FK SET NULL.** If the linked task is deleted, the message stays for audit but loses the link.

## State machines
None — sessions are a flag (`is_active`); messages are append-only.

## External dependencies
- **Project** (FK `ON DELETE CASCADE`).
- **User** (FK `ON DELETE CASCADE`) — the business user driving the chat.
- **Task** (FK on `linked_task_id`, `ON DELETE SET NULL`).
- **External AI provider** — token_count is tracked for cost monitoring; integration lives outside this module.

## Critical edge cases
- **Switching to a new session while old one's request is in flight.** Service layer should reject — the AI request belongs to a session that is no longer active.
- **Concurrent message insertion.** Always increment `message_order` inside a transaction with row lock on the session row, OR use `SELECT COALESCE(MAX(message_order), 0) + 1`. Unique constraint will catch any race.
- **Token cost overruns.** No DB-level enforcement; service layer should check user/project quotas before calling the AI provider.
