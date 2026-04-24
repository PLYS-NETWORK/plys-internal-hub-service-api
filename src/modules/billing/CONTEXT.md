# Billing — Business Context

## Purpose
Owns the monthly credit-based billing cycle for businesses that do not pay upfront. Each month the system closes a billing period, creates an invoice with a line-item breakdown of settled tasks, sends the invoice by email, and processes payment via the Payments module when the business pays. Also exposes admin-only endpoints for manual operations.

## Tables owned
- `billing_periods` — one row per business per calendar month; tracks open/finalized/paid state.
- `invoices` — one invoice per billing period; holds amounts, commission snapshot, processor IDs, payment status.
- `invoice_line_items` — one row per settled task; snapshot of task pricing, platform fee, and consultant payout at settlement time.

---

## Key entities

### BillingPeriod
| Field | Notes |
|---|---|
| `business_id` | FK to `business_profiles` |
| `period_start` | First day of the month (`YYYY-MM-DD`) |
| `period_end` | Last day of the month |
| `status` | `OPEN → FINALIZED → PAID` (or `OVERDUE`, `DISPUTED`) |
| `total_amount` | Sum of all settled task amounts in the period |
| `finalized_at` | Timestamp when the period was closed by the cron |

### Invoice
| Field | Notes |
|---|---|
| `billing_period_id` | 1:1 FK (unique) |
| `business_id` | Denormalized for query convenience |
| `task_total` | Sum of task prices — subtotal before commission |
| `commission_rate` | Snapshotted from `business_profiles.commission_rate` at invoice creation |
| `commission_amount` | `task_total × commission_rate` |
| `amount` | Total charged = `task_total + commission_amount` |
| `currency` | `Currency.USD` (default) |
| `status` | `PENDING → PAID` (or `OVERDUE`, `CANCELLED`, `REFUNDED`) |
| `due_date` | Payment deadline |
| `paid_at` | Timestamp when webhook confirmed payment |
| `notified_at` | Timestamp when invoice email was successfully delivered (null = not yet sent) |
| `processor_name` | `PaymentProcessor.POLAR` or `STRIPE` |
| `processor_invoice_id` | Polar checkout ID / Stripe session ID (unique idempotency key) |
| `processor_payment_url` | Hosted checkout URL shown to the business |

### InvoiceLineItem
| Field | Notes |
|---|---|
| `invoice_id` | FK to invoice |
| `task_id` | FK to task (`SET NULL` on delete — snapshot survives task deletion) |
| `consultant_id` | Consultant who completed the task |
| `project_id` | Project the task belongs to |
| `amount` | Full task price (= platform_fee_amount + consultant_payout) |
| `platform_fee_amount` | Platform's share |
| `consultant_payout` | Consultant's share |
| DB CHECK | `amount = platform_fee_amount + consultant_payout` enforced at DB level |

---

## Monthly settlement flow (cron)

**Schedule:** `@Cron('0 8 1 * *')` — 08:00 on the 1st of every month.

Runs in two independent phases to make email delivery retryable:

### Phase 1 — `createMonthlyInvoices(year, month)` (via `runSettlement`)
For each credit-based business with tasks settled in the previous month:
1. Load (or create) the `BillingPeriod` for `(businessId, year, month)`.
2. Collect all `InvoiceLineItem` rows for that period.
3. Compute:
   - `taskTotal` = sum of line-item amounts.
   - `commissionRate` = `businessProfile.commissionRate` (snapshotted now).
   - `commissionAmount` = `taskTotal × commissionRate`.
   - `invoiceTotal` = `taskTotal + commissionAmount`.
4. Create `Invoice` with all amounts, `status: PENDING`, `notifiedAt: null`.
5. Create `BusinessTransaction` (`type: MONTHLY_BILLING`, `status: PENDING`, `invoiceId` linked).
6. Set `billingPeriod.status = FINALIZED`, stamp `finalizedAt`.

### Phase 2 — `dispatchPendingInvoiceEmails(year, month)`
Query invoices in that period where `notifiedAt IS NULL` AND `status = PENDING`:
- Call `sendInvoiceEmail(invoice)` for each.
- On success: stamp `invoice.notifiedAt = new Date()` and save.
- On failure: log error, continue (individual failures do not abort the batch).
- Log sent/failed counts at the end.

**Why two phases?** If the mailer is down, `notifiedAt` stays null. The next cron (or admin manual resend) retries only the unsent invoices without re-creating transactions.

---

## `sendInvoiceEmail(invoice)` — shared helper
Used by Phase 2 and the admin `POST /admin/bills/:invoiceId/send` endpoint.

1. Load `billingPeriod`, `businessProfile`, `user`, and `lineItems` from the invoice.
2. Build the email template with full amounts + line-item breakdown.
3. Call `EmailService.sendMonthlyInvoiceEmail`.
4. On success: set `invoice.notifiedAt = new Date()` and save.
5. Throws on failure — caller decides whether to catch or propagate.

---

## Invoice payment flow

1. Business sees a `PENDING` invoice; calls `POST /payments/business/settle-invoice`.
2. PaymentsModule creates a Polar checkout session; saves `processorInvoiceId` + `processorPaymentUrl` on the invoice.
3. Business pays at the Polar checkout URL.
4. Polar fires `order.paid` → WebhooksModule → `BillingInvoiceService.completeInvoicePayment(invoiceId, transactionId, processorInvoiceId)`.
5. `completeInvoicePayment`:
   - Loads invoice; asserts `invoice.processorInvoiceId === processorInvoiceId` (anti-forgery check — mismatch is logged as error and silently skipped to avoid webhook retry storm).
   - In a DB transaction:
     - Set `invoice.status = PAID`, stamp `invoice.paidAt`.
     - Update `BusinessTransaction` → `status: COMPLETED`.
     - Set `billingPeriod.status = PAID`.

---

## Admin API (`BillingController` — `admin/bills`)

All endpoints require `@Roles(UserRole.ADMIN_PLATFORM)`.

| Method | Path | Description |
|---|---|---|
| GET | `/admin/bills` | Paginated list of billing periods with invoice summary. Filter by `status`, `business_id`. |
| GET | `/admin/bills/:invoiceId` | Full invoice detail with commission breakdown and line items (task title, project title). |
| POST | `/admin/bills/trigger-settlement` | Manually trigger settlement for a `year`/`month` (and optionally one `business_id`). |
| POST | `/admin/bills/:invoiceId/send` | Manually (re)send the invoice email. Always updates `notifiedAt`. |

### Bill detail response structure
```json
{
  "id": "<billingPeriodId>",
  "business_id": "...",
  "period_start": "2026-04-01",
  "period_end": "2026-04-30",
  "status": "finalized",
  "total_amount": "1250.00",
  "finalized_at": "2026-05-01T08:00:00.000Z",
  "invoice": {
    "id": "<invoiceId>",
    "task_total": "1000.00",
    "commission_rate": "0.2500",
    "commission_amount": "250.00",
    "amount": "1250.00",
    "currency": "USD",
    "status": "pending",
    "due_date": "2026-05-15",
    "paid_at": null,
    "notified_at": "2026-05-01T08:10:00.000Z",
    "processor_name": "polar",
    "processor_payment_url": "https://checkout.polar.sh/...",
    "line_items": [
      {
        "task_id": "...",
        "task_title": "Implement auth module",
        "project_id": "...",
        "project_title": "E-commerce Platform",
        "consultant_id": "...",
        "amount": "500.00",
        "platform_fee_amount": "125.00",
        "consultant_payout": "375.00"
      }
    ]
  }
}
```

---

## BillingPeriodStatus state machine
```
OPEN → FINALIZED → PAID
              ↘ OVERDUE
              ↘ DISPUTED
```
| Status | Meaning |
|---|---|
| `OPEN` | Period is accumulating task settlements. |
| `FINALIZED` | Cron closed the period; invoice created and email pending. |
| `PAID` | Invoice paid; webhook confirmed. |
| `OVERDUE` | Past due date and not paid. |
| `DISPUTED` | Manually flagged by admin. |

---

## Commission model
- Rate stored on `business_profiles.commission_rate` (numeric 5,4; default `0.2500` = 25%).
- **Snapshotted** into `invoices.commission_rate` at invoice creation — historical invoices remain correct if the rate changes later.
- `commission_amount = task_total × commission_rate`.
- `amount = task_total + commission_amount`.
- Commission does NOT apply to pre-paid businesses (charged at project publish time via ProjectsModule).

---

## Key invariants
- **`notifiedAt` is the email audit flag.** Phase 2 and admin resend query `notifiedAt IS NULL` to find unsent invoices. Never use any other field for this.
- **`processorInvoiceId` cross-check.** Webhook completion asserts this matches the stored value — prevents a forged-metadata attack from marking an unrelated invoice paid.
- **Commission snapshotted.** `invoices.commission_rate` never changes after creation.
- **Line items are immutable.** Created once during settlement; never updated or deleted (task FK is `SET NULL` on task deletion, but the line item row survives).
- **One invoice per billing period.** `uq_invoices_billing_period_id` enforces uniqueness at the DB level.
- **Credit businesses only.** Pre-paid businesses (`allowPaymentCredit = false`) are charged at project publish time; they never appear in the billing cycle.

## External dependencies
- **TasksModule** — tasks are marked settled (assigned to a `billing_period_id`) by the task settlement process; billing reads these.
- **PaymentsModule** — `settleInvoice` creates the checkout; the webhook calls `completeInvoicePayment` back into billing.
- **EmailService** — `sendMonthlyInvoiceEmail` sends the invoice notification email.
- **BusinessProfile** — `commission_rate` read at invoice creation; `account_balance` is NOT touched by billing.
