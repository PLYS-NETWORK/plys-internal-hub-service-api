# Business Transactions — Business Context

## Purpose
Owns the business-side counterpart to the wallet ledger: every invoice, payment, refund, and dispute event recorded against the business for audit and reporting.

## Tables owned
- `business_transactions` — append-only ledger of finance events affecting a business.

## Key invariants
- **Append-only.** Never update — write a new row with the corrected event.
- **`processor_event_id` UNIQUE** for idempotency against webhook replays.
- **Type values:** `invoice_created`, `payment_received`, `refund_issued`, `dispute_opened`, `dispute_resolved`.
- **Refs are SET NULL.** Deleting an invoice / task / project does not erase the historical row.

## State machines
None — `status` is `completed | pending | failed | reversed`.

## External dependencies
- **Billing** — invoice creation produces `invoice_created`; payment confirmation produces `payment_received`.
- **Tasks** — disputes produce `dispute_opened` / `dispute_resolved`.
- **WebhookEvents** — payment processor confirmations.
- **Notifications** — payment received → `billing+` business members.

## Critical edge cases
- **Refund partial vs full.** Negative or partial `amount` should be normalized at write time to a positive `refund_issued` with the partial value; sign is implicit in the type, not the amount.
- **Reconciliation.** Periodic `SUM(amount) GROUP BY business_id, type` against the processor's reports.
