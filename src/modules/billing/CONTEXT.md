# Billing — Business Context

## Purpose
Owns monthly billing periods per business, the invoice generated for each period, and the per-task line items that make up that invoice. Runs the monthly credit settlement cron that generates invoices for credit-based businesses. Consultants are NOT paid during settlement — they are credited only after the business pays the invoice. Real money is processed by Polar — this module is a ledger.

## Tables owned
- `billing_periods` — monthly window per business; status moves through `open → finalized → paid`.
- `invoices` — one per billing period; carries the processor's invoice id + payment URL for reconciliation.
- `invoice_line_items` — one per approved task; stores `amount`, `platform_fee_amount`, `consultant_payout` snapshot.

## Key invariants
- **Always create periods via `get_or_create_billing_period(business_id, year, month)`.** Direct INSERTs race; the function uses `ON CONFLICT DO NOTHING`.
- **One invoice per billing period.** `billing_period_id` UNIQUE on `invoices`.
- **`processor_invoice_id` UNIQUE.** Polar will not let two invoices share an id. Webhook handlers rely on this for idempotent lookups.
- **Line item math is consistent.** CHECK `amount = platform_fee_amount + consultant_payout` enforces internal consistency of the snapshot.
- **`(invoice_id, task_id)` UNIQUE** on `invoice_line_items` — a task is billed at most once.
- **`period_end >= period_start`** — CHECK constraint.
- **25% platform commission ON TOP.** Invoice total = task total + (task total * 0.25). The commission is added on top of task prices, not deducted from them.

## Monthly Credit Settlement

### Schedule
`@Cron('0 8 1 * *')` — runs on the 1st of every month at 08:00 AM.

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
All steps run inside a single `uow.withTransaction()` for atomicity.
**Consultant crediting does NOT happen here** — it happens in the webhook handler after the business pays.

```
1. Calculate invoice totals
   - taskTotal = SUM(task.price) for all settled tasks
   - commissionAmount = taskTotal * 0.25  (25% platform fee ON TOP)
   - invoiceTotal = taskTotal + commissionAmount

2. Get or create billing period
   - SQL: get_or_create_billing_period(businessId, year, month+1)
   - Note: JS months are 0-indexed, SQL function expects 1-indexed

3. Create invoice
   - billingPeriodId, businessId, amount = invoiceTotal
   - status = PENDING, dueDate = 15th of current month

4. Link consultant transactions to invoice (keep PENDING)
   - Set invoiceId on each ConsultantTransaction
   - Status stays PENDING — consultants are credited on payment

5. Create line items (one per settled task)
   - Snapshot: amount (task.price), platformFeeAmount, consultantPayout
   - Links: invoiceId, taskId, consultantId, projectId

6. Create business transaction
   - type = MONTHLY_BILLING, amount = invoiceTotal, status = PENDING
   - invoiceId linked, note includes breakdown

7. Update billing period
   - status = FINALIZED, totalAmount = invoiceTotal, finalizedAt = NOW()
```

After the transaction commits (best-effort, failure does not roll back):
```
8. Send email notification to business
   - Loads businessProfile with user relation for email
   - Email includes: business name, billing period, due date, line items,
     subtotal, commission, total, and "Pay Invoice" CTA link
```

## Invoice Payment Flow

### API: `POST /payments/business/settle-invoice`
Lives in the **payments module** (same pattern as top-up checkout).

```
1. Validate business ownership of invoice
2. Reject if already PAID
3. Find linked MONTHLY_BILLING business transaction
4. Create Polar checkout session (invoiceProductId)
   - metadata: { transactionId, businessId, invoiceId, type: 'invoice_payment' }
5. Save processor IDs on invoice
6. Return { invoice_id, redirect_url }
```

### Webhook: `handlePaymentSucceeded` (type = 'invoice_payment')
Routes to `BillingInvoiceService.completeInvoicePayment()`.

### Service: `BillingInvoiceService.completeInvoicePayment(invoiceId, transactionId)`
All steps run inside a single `uow.withTransaction()` for atomicity. Idempotent — returns early if invoice is already PAID.

```
1. Mark invoice status = PAID, paidAt = NOW()
2. Mark business transaction status = COMPLETED
3. Mark billing period status = PAID
4. Find all PENDING consultant transactions linked to this invoice
5. Aggregate payout amounts by consultant
6. Mark each consultant transaction status = COMPLETED
7. Credit each consultant's accountBalance
```

### Settlement & Payment Flow Diagram
```
BillingSettlementService (cron: 1st of month, 08:00)
  │
  ├─ Find CREDIT_PENDING ConsultantTransactions from previous month
  ├─ Group by business
  │
  └─ Per business (atomic transaction):
       ├─ Calculate: taskTotal + 25% commission = invoiceTotal
       ├─ get_or_create_billing_period(businessId, year, month)
       ├─ Create Invoice (PENDING, due 15th)
       ├─ Link ConsultantTransactions to invoice (keep PENDING)
       ├─ Create InvoiceLineItem per task (snapshot)
       ├─ Create BusinessTransaction (MONTHLY_BILLING, PENDING)
       ├─ Finalize BillingPeriod
       └─ Send email to business (best-effort, after commit)

Business pays invoice:
  POST /payments/business/settle-invoice
  │
  ├─ Validate ownership & status
  ├─ Create Polar checkout session
  └─ Return redirect URL

Polar webhook (checkout.completed, type=invoice_payment):
  BillingInvoiceService.completeInvoicePayment()
  │
  ├─ Mark Invoice PAID
  ├─ Mark BusinessTransaction COMPLETED
  ├─ Mark BillingPeriod PAID
  ├─ Mark ConsultantTransactions COMPLETED
  └─ Credit each consultant's accountBalance
```

## State machines
```
billing_periods:  open → finalized → paid
                                  ↘ overdue → paid
                                  ↘ disputed

invoices:  pending → paid
                  → overdue → paid
                  → cancelled
                  → refunded
```

## External dependencies
- **Tasks** — `tasks.billing_period_id` is set when a task enters billing. FK added in this domain's migration. Settlement reads `task.price`, `task.platformFeeAmount`, `task.consultantPayout` for line item snapshots.
- **ConsultantProfiles** — `accountBalance` credited during invoice payment (NOT during settlement).
- **ConsultantTransactions** — source data for settlement (CREDIT_PENDING, linked to invoice). Credited to COMPLETED on invoice payment. Owned by Payments module.
- **BusinessTransactions** — MONTHLY_BILLING entries created during settlement. Owned by Payments module.
- **Payments** — `POST /payments/business/settle-invoice` creates Polar checkout. Webhook routes `invoice_payment` type to `BillingInvoiceService`.
- **Notifications** — invoice generated email sent during settlement (best-effort).
- **WebhookEvents** — payment processor confirmations land in `webhook_events` first; webhook handler routes by `metadata.type`.
- **DataSource** — direct SQL query for `get_or_create_billing_period()` function (race-safe upsert).

## Critical edge cases
- **Concurrent task approvals at month boundary.** Two tasks approved at 23:59:59 and 00:00:00 land in different periods — `get_or_create_billing_period` ensures the right one for each.
- **January rollover.** `settleMonthlyCredits()` explicitly handles month 0 → previous December of prior year.
- **Partial business failure.** If settlement fails for one business (e.g., missing data), other businesses are still settled. The failed business is logged and skipped.
- **No pending transactions.** If a business has no CREDIT_PENDING transactions for the previous month, it is skipped entirely — no empty invoice created.
- **Email failure.** If the email notification fails after settlement, the invoice is still persisted — email is best-effort.
- **Invoice payment idempotency.** `completeInvoicePayment()` returns early if invoice is already PAID, preventing double crediting.
- **Currency mismatch.** All line items in one invoice should share `currency`. No DB CHECK; service layer enforces.
- **Null task/project on ConsultantTransaction.** The cron filters out transactions with null `task` or `task.project` (possible if task was deleted). Non-null assertions in `settleBusinessCredits()` rely on this pre-filtering.
