# Webhooks — Business Context

## Purpose
Owns the raw inbound webhook log from payment processors (Stripe, Polar). Provides idempotency, retry scheduling, and the audit trail for everything money-related.

## Tables owned
- `webhook_events` — raw payload + processing status + retry metadata.

## Key invariants
- **`(processor, event_id)` UNIQUE.** §C4 fix — processors don't share an id namespace, but global uniqueness was incorrect. Webhook handler MUST check this for idempotency: second arrival of the same event finds the row, returns 200, no side-effect.
- **Single-transaction processing.** Every side-effect a webhook triggers (invoice update, wallet credits, business transaction, notifications) MUST run inside one DB transaction. Partial application = corrupt ledger.
- **Retry strategy.** `next_retry_at` set when status flips to `failed`. A scheduled worker picks up failed events with `next_retry_at < NOW()`. `retry_count` caps at the worker level (e.g. 5 attempts).
- **`payload`** stored as JSONB; preserved verbatim for forensic replay.

## State machines
```
received → pending → processing → processed
                              → failed → (retry) → processing → ...
                              → skipped (manually marked irrelevant)
```

## External dependencies
- **Billing** — invoice payment confirmation.
- **Wallets** — credit_cleared / debit_pending / reversal entries.
- **BusinessTransactions** — payment_received / refund_issued / dispute_opened.
- **Notifications** — wallet credited, payment received, dispute opened.

## Critical edge cases
- **Out-of-order delivery.** Stripe might send `invoice.paid` before `invoice.finalized`. Handlers must be order-independent — branch on event_type.
- **Double processing.** Mitigated by the UNIQUE constraint + transaction wrapping.
- **Manual replay.** Setting `status = 'pending'` and clearing `processed_at` reschedules the worker to re-run side-effects — only do this if the original processing was incomplete.
- **Unknown event_type.** Set `status = 'skipped'` and log; never throw — the processor will keep retrying, infinite loop.
- **High-cardinality table.** Long-term, partition or archive `webhook_events` by month.
