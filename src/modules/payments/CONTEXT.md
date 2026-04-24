# Payments — Business Context

## Purpose
Owns all money movement for both business and consultant roles: top-ups (business balance deposits), withdrawals (both roles to Stripe Connect), invoice settlement (business pays monthly invoice via checkout), and transaction history. Delegates checkout-session creation and Stripe transfers to the provider-agnostic `PaymentService` (common module) and receives payment confirmations via the Webhooks module.

## Tables owned
- `business_transactions` — append-only ledger of all financial events for a business.
- `consultant_transactions` — append-only ledger of all financial events for a consultant.

Balance columns mutated here (owned by profile modules):
- `business_profiles.account_balance` — current business balance (numeric 15,2).
- `consultant_profiles.account_balance` — current consultant balance (numeric 15,2).

---

## Business transaction types (`BusinessTransactionType`)
| Type | Description |
|---|---|
| `TOP_UP` | Balance deposit via Polar/Stripe checkout |
| `WITHDRAW` | Withdrawal to Stripe Connect |
| `REFUND` | Refund credited back to balance (e.g. on project recall) |
| `PROJECT_PUBLISHED` | Pre-paid project publication charge (tasks + commission) |
| `TASK_ADDED` | Pre-paid task addition charge after project is live |
| `MONTHLY_BILLING` | Credit-based monthly invoice charge (created by BillingModule) |

## Consultant transaction types (`ConsultantTransactionType`)
| Type | Description |
|---|---|
| `CREDIT_PENDING` | Task earnings credited (held until billing period settled) |
| `CREDIT_CLEARED` | Pending credit released to cleared balance |
| `DEBIT_PENDING` | Reserved for future debits |
| `WITHDRAWAL` | Withdrawal to Stripe Connect |
| `REVERSAL` | Reversal of a prior transaction |

---

## Endpoints

### Shared — `PaymentsController` (`/payments`)
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/payments/withdraw` | `@Roles(USER)` | Withdraw to Stripe Connect. Routes to `BusinessWithdrawStrategy` or `ConsultantWithdrawStrategy` based on `requestContext.activePlatform`. |

### Business — `BusinessPaymentsController` (`/payments/business`)
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/payments/business/top-up` | `@Roles(USER)` `@Platform(BUSINESS)` | Create a Polar checkout session for balance top-up. |
| POST | `/payments/business/settle-invoice` | `@Roles(USER)` `@Platform(BUSINESS)` | Create a Polar checkout session to pay a monthly invoice. |
| GET | `/payments/business/transactions` | `@Roles(USER)` `@Platform(BUSINESS)` | Paginated business transaction history. |

### Consultant — `ConsultantPaymentsController` (`/payments/consultant`)
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/payments/consultant/transactions` | `@Roles(USER)` `@Platform(CONSULTANT)` | Paginated consultant transaction history. |

---

## Flow: Business Top-Up

1. Business calls `POST /payments/business/top-up` with `{ amount, success_url, cancel_url }`.
2. Service creates a `BusinessTransaction` with `type: TOP_UP`, `status: PENDING`.
3. Calls `PaymentService.createCheckoutSession` with:
   - `amount` (in cents), `currency: Currency.USD`
   - `externalProductId: env.polarTopUpProductId`
   - `metadata: { transactionId, businessId, type: CheckoutPaymentType.TOP_UP }`
4. Saves `processorEventId = checkoutSession.processorInvoiceId` on the transaction.
5. Returns `{ transaction_id, redirect_url }` — frontend redirects to Polar checkout.
6. On payment success, Polar fires `order.paid` → Webhooks module → `handlePaymentSucceeded`.
7. Webhook identifies `type: TOP_UP` (no `invoiceId` in metadata) → updates the `BusinessTransaction` to `COMPLETED`, adds amount to `businessProfile.accountBalance`.

---

## Flow: Business Settle Invoice

1. Business calls `POST /payments/business/settle-invoice` with `{ invoice_id, success_url, cancel_url }`.
2. Service validates: invoice exists, belongs to the business, not already `PAID`.
3. Finds the linked `BusinessTransaction` with `type: MONTHLY_BILLING` and `invoiceId`.
4. Calls `PaymentService.createCheckoutSession` with:
   - `amount = invoice.amount` (in cents)
   - `externalProductId: env.polarInvoiceProductId`
   - `metadata: { transactionId, businessId, invoiceId, type: CheckoutPaymentType.INVOICE_PAYMENT }`
5. Saves processor IDs on `Invoice` (`processorName: PaymentProcessor.POLAR`, `processorInvoiceId`, `processorPaymentIntentId`, `processorPaymentUrl`).
6. Returns `{ invoice_id, redirect_url }`.
7. On payment success, Polar fires `order.paid` → Webhooks → `handlePaymentSucceeded`.
8. Webhook identifies `type: INVOICE_PAYMENT` → cross-checks `processorInvoiceId` to prevent metadata-forgery → calls `BillingInvoiceService.completeInvoicePayment`.

---

## Flow: Withdraw (Business or Consultant)

1. Caller posts `POST /payments/withdraw` with `{ amount, success_url, cancel_url }`.
2. `PaymentsService` resolves `activePlatform` from `RequestContextService` and delegates to the correct `IWithdrawStrategy`.
3. **`BusinessWithdrawStrategy`:**
   - If `stripeConnectAccountId` is null → return Stripe OAuth onboarding URL (no charge).
   - Validate balance ≥ amount.
   - In a DB transaction: create `BusinessTransaction (WITHDRAW, PENDING)`, deduct balance.
   - Call `PaymentService.createTransfer` with `currency: Currency.USD`.
   - On success: mark transaction `COMPLETED`, save `processorEventId`.
4. **`ConsultantWithdrawStrategy`:** identical pattern using `consultant_transactions` + `consultantProfiles`.
5. Returns `{ is_connected, onboarding_url?, transaction_id, status }`.

---

## Payment provider abstraction (`common/modules/payment`)

`PaymentService` is a thin facade over the active provider (set by `PAYMENT_PROCESSOR` env var, default `polar`):

| Method | Description |
|---|---|
| `createCheckoutSession(params)` | Creates a hosted payment page. Returns `{ processorInvoiceId, processorPaymentIntentId, processorPaymentUrl }`. |
| `createTransfer(params)` | Sends funds to a Stripe Connect account. |
| `constructWebhookEvent(payload, headers)` | Verifies the webhook signature and returns a normalized `WebhookEvent`. |

**Polar product requirements:**
- `polarTopUpProductId` and `polarInvoiceProductId` must be **custom-price** (`pay_what_you_want`) products.
- The provider asserts `amountType === 'custom'` before creating a checkout and throws `InternalServerErrorException` if not — this ensures the amount cannot be tampered with by the customer in the Polar UI.

**Amount lock:**
- Polar: locked via custom-price product + `amount` param in checkout.
- Stripe: locked via inline `price_data.unit_amount` — customer cannot edit.

---

## Checkout metadata contract (`CheckoutPaymentType`)
All checkout sessions pass `type` in metadata to route the webhook correctly:

| `type` value | Webhook route |
|---|---|
| `CheckoutPaymentType.TOP_UP` | Update `BusinessTransaction` + credit `accountBalance` |
| `CheckoutPaymentType.INVOICE_PAYMENT` | `BillingInvoiceService.completeInvoicePayment` |

---

## Transaction entity fields (both tables)
| Field | Notes |
|---|---|
| `amount` | Subtotal before commission (task prices, top-up value) |
| `commission_rate` | Snapshotted rate (null if no commission applies) |
| `commission_amount` | Computed commission (null if no commission) |
| `total_amount` | Final charge = amount + commission_amount |
| `status` | `PENDING → COMPLETED / FAILED / REVERSED` |
| `processor_event_id` | Idempotency key from payment processor (UNIQUE constraint) |

---

## Key invariants
- **Append-only ledgers.** Never UPDATE a transaction row — write a `REVERSAL` row instead.
- **Idempotency.** `processor_event_id` has a UNIQUE constraint; duplicate webhook deliveries are rejected at the DB level.
- **Balance precision.** `parseFloat` → arithmetic → `.toFixed(2)` → save. Never accumulate floating-point over multiple operations.
- **Stripe Connect onboarding.** If `stripeConnectAccountId` is null, withdrawal returns an OAuth URL instead of executing a transfer. No balance is touched.
- **`processorInvoiceId` cross-check.** The webhook handler asserts `invoice.processorInvoiceId === event.checkoutId` before marking any invoice paid, closing the metadata-forgery attack surface.

## External dependencies
- **BillingModule** — invoice settlement webhook delegates to `BillingInvoiceService.completeInvoicePayment`.
- **WebhooksModule** — receives Polar/Stripe events; routes to top-up or invoice completion logic.
- **BusinessProfile / ConsultantProfile** — balance columns mutated on every completed transaction.
- **PaymentService** (common) — provider-agnostic checkout and transfer abstraction.
