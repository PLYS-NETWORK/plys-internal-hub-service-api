# Billing — Business Context

## Purpose
Owns monthly billing periods per business, the invoice generated for each period, and the per-task line items that make up that invoice. Real money is processed by Stripe / Polar — this module is a ledger.

## Tables owned
- `billing_periods` — monthly window per business; status moves through `open → finalized → invoiced → paid`.
- `invoices` — one per billing period; carries the processor's invoice id + payment URL for reconciliation.
- `invoice_line_items` — one per approved task; stores `amount`, `platform_fee_amount`, `consultant_payout` snapshot.

## Key invariants
- **Always create periods via `get_or_create_billing_period(business_id, year, month)`.** Direct INSERTs race; the function uses `ON CONFLICT DO NOTHING`.
- **One invoice per billing period.** `billing_period_id` UNIQUE on `invoices`.
- **`processor_invoice_id` UNIQUE.** Stripe/Polar will not let two invoices share an id. Webhook handlers rely on this for idempotent lookups.
- **Line item math is consistent.** §M8 — CHECK `amount = platform_fee_amount + consultant_payout` enforces internal consistency of the snapshot.
- **`(invoice_id, task_id)` UNIQUE** on `invoice_line_items` — a task is billed at most once.
- **`period_end >= period_start`** — CHECK constraint.

## State machines
```
billing_periods:  open → finalized → invoiced → paid
                                            ↘ overdue → paid
                                            ↘ disputed

invoices:  pending → paid
                  → overdue → paid
                  → cancelled
                  → refunded
```

## External dependencies
- **Tasks** — `tasks.billing_period_id` is set when a task enters billing. FK added in this domain's migration.
- **Payments** — invoice creation / payment confirmation produces `consultant_transactions` (credit_pending → credit_cleared + debit_pending) and `business_transactions` rows. Both tables are owned by the Payments module.
- **Notifications** — invoice generated, payment due, payment received → `billing+` business members.
- **WebhookEvents** — payment processor confirmations land in `webhook_events` first; this module reads them via the idempotency gate.

## Critical edge cases
- **Concurrent task approvals at month boundary.** Two tasks approved at 23:59:59 and 00:00:00 land in different periods — `get_or_create_billing_period` ensures the right one for each.
- **Re-issuing an invoice after dispute.** Set status `cancelled`, then create a new invoice for the same billing period — but the unique constraint on `billing_period_id` prevents this; you'd need to nullify the old invoice's `billing_period_id` first or operate at the line-item level.
- **Currency mismatch.** All line items in one invoice should share `currency`. No DB CHECK; service layer enforces.
