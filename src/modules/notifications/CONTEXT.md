# Notifications — Business Context

## Purpose
Owns the cross-platform event log delivered to users. Every meaningful workflow event (application received, task approved, invoice paid, wallet credited) writes a row here addressed to the affected user(s).

## Tables owned
- `notifications` — append-only event log per user; deep-link refs to the relevant project/task/application/invoice; arbitrary JSONB metadata.

## Key invariants
- **Append-only.** Rows are inserted by event producers (other modules); marked read by the recipient. Never updated otherwise. No delete (use `is_read` to filter).
- **Reference columns are SET NULL.** Deleting a referenced project/task/application/invoice does NOT cascade-delete the notification — the notification stays as a historical record with a null ref.
- **`metadata` is unstructured.** Each `type` value implies its own schema. Document the schema per `type` in the producing module's CONTEXT.md if it gets non-trivial.
- **Recipient targeting** is the producer's responsibility. Notifications about applications go to `manager+` business members; about wallet to the consultant; about invoices to `billing+` members.

## State machines
None. `is_read` is a single binary flip. Lifecycle ends at filter time.

## External dependencies
- Every producing module (Auth, Projects, Tasks, Applications, Billing, Wallets) writes notifications.
- **User** (FK CASCADE) — deleting a user removes their notification feed (intentional — privacy / GDPR).

## Critical edge cases
- **Producer side-effect failure.** Notifications should be written inside the same transaction as the event that triggered them, so a rollback removes both. If notifications must survive a producer failure, write them via an outbox pattern instead — but the v2 design assumes same-transaction semantics.
- **Bulk events.** A status change broadcast to many members = many INSERTs. Batch them in one INSERT with VALUES list.
- **Real-time delivery** is the consumer's concern (WebSocket/SSE); this table only persists.
- **Retention.** Long-term notifications grow unbounded — schedule a periodic prune of `is_read = TRUE AND created_at < NOW() - INTERVAL '6 months'` once the system is in production.
