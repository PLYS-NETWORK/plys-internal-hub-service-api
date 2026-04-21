# Billing — Business Context

## Purpose
Owns monthly billing periods per business, the invoice generated for each period, and the per-task line items that make up that invoice. Also runs the monthly credit settlement cron that pays consultants and generates invoices for credit-based businesses. Real money is processed by Stripe / Polar — this module is a ledger.

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
- **25% platform commission ON TOP.** Invoice total = task total + (task total * 0.25). The commission is added on top of task prices, not deducted from them.

## Monthly Credit Settlement

### Schedule
`@Cron('0 2 5 * *')` — runs on the 5th of every month at 02:00 AM.

### Service: `BillingSettlementService`

#### `settleMonthlyCredits()` — Cron Entry Point
```
1. Compute previous month (handles January → December year rollover)
2. Find all ConsultantTransactions where:
   - type = CREDIT_PENDING
   - status = PENDING
   - relations: task → project (for business grouping)
3. Filter to transactions created in the previous month
4. Group by businessId (derived from task.project.businessId)
5. For each business: call settleBusinessCredits() in try/catch
   - Failure for one business does not block others
   - Errors are logged, not thrown
```

#### `settleBusinessCredits(businessId, pendingTxns, year, month)` — Per-Business Settlement
All steps run inside a single `uow.withTransaction()` for atomicity:

```
1. Credit consultants
   - Aggregate pending amounts per consultant
   - For each consultant:
     a. Mark each ConsultantTransaction status = COMPLETED
     b. Credit consultantProfile.accountBalance += total

2. Calculate invoice totals
   - taskTotal = SUM(task.price) for all settled tasks
   - commissionAmount = taskTotal * 0.25  (25% platform fee ON TOP)
   - invoiceTotal = taskTotal + commissionAmount

3. Get or create billing period
   - SQL: get_or_create_billing_period(businessId, year, month+1)
   - Note: JS months are 0-indexed, SQL function expects 1-indexed

4. Create invoice
   - billingPeriodId, businessId, amount = invoiceTotal
   - status = PENDING, dueDate = 15th of current month

5. Create line items (one per settled task)
   - Snapshot: amount (task.price), platformFeeAmount, consultantPayout
   - Links: invoiceId, taskId, consultantId, projectId

6. Create business transaction
   - type = MONTHLY_BILLING, amount = invoiceTotal, status = PENDING
   - invoiceId linked, note includes breakdown

7. Update billing period
   - status = FINALIZED, totalAmount = invoiceTotal, finalizedAt = NOW()
```

### Settlement Flow Diagram
```
BillingSettlementService (cron: 5th of month, 02:00)
  │
  ├─ Find CREDIT_PENDING ConsultantTransactions from previous month
  ├─ Group by business
  │
  └─ Per business (atomic transaction):
       ├─ Credit each consultant's balance
       ├─ Mark ConsultantTransactions COMPLETED
       ├─ Calculate: taskTotal + 25% commission = invoiceTotal
       ├─ get_or_create_billing_period(businessId, year, month)
       ├─ Create Invoice (PENDING, due 15th)
       ├─ Create InvoiceLineItem per task (snapshot)
       ├─ Create BusinessTransaction (MONTHLY_BILLING, PENDING)
       └─ Finalize BillingPeriod
```

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
- **Tasks** — `tasks.billing_period_id` is set when a task enters billing. FK added in this domain's migration. Settlement reads `task.price`, `task.platformFeeAmount`, `task.consultantPayout` for line item snapshots.
- **ConsultantProfiles** — `accountBalance` credited during settlement.
- **ConsultantTransactions** — source data for settlement (CREDIT_PENDING → COMPLETED). Owned by Payments module.
- **BusinessTransactions** — MONTHLY_BILLING entries created during settlement. Owned by Payments module.
- **Payments** — invoice creation / payment confirmation produces `consultant_transactions` (credit_pending → credit_cleared + debit_pending) and `business_transactions` rows. Both tables are owned by the Payments module.
- **Notifications** — invoice generated, payment due, payment received → `billing+` business members.
- **WebhookEvents** — payment processor confirmations land in `webhook_events` first; this module reads them via the idempotency gate.
- **DataSource** — direct SQL query for `get_or_create_billing_period()` function (race-safe upsert).

## Critical edge cases
- **Concurrent task approvals at month boundary.** Two tasks approved at 23:59:59 and 00:00:00 land in different periods — `get_or_create_billing_period` ensures the right one for each.
- **January rollover.** `settleMonthlyCredits()` explicitly handles month 0 → previous December of prior year.
- **Partial business failure.** If settlement fails for one business (e.g., missing data), other businesses are still settled. The failed business is logged and skipped.
- **No pending transactions.** If a business has no CREDIT_PENDING transactions for the previous month, it is skipped entirely — no empty invoice created.
- **Re-issuing an invoice after dispute.** Set status `cancelled`, then create a new invoice for the same billing period — but the unique constraint on `billing_period_id` prevents this; you'd need to nullify the old invoice's `billing_period_id` first or operate at the line-item level.
- **Currency mismatch.** All line items in one invoice should share `currency`. No DB CHECK; service layer enforces.
- **Null task/project on ConsultantTransaction.** The cron filters out transactions with null `task` or `task.project` (possible if task was deleted). Non-null assertions in `settleBusinessCredits()` rely on this pre-filtering.
