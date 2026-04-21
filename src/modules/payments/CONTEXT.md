# Payments — Business Context

## Purpose
Owns all money movement for both business and consultant roles: top-ups (business deposits), withdrawals (both roles to Stripe Connect), and transaction history. Delegates checkout and transfer creation to a provider-agnostic `PaymentService` (common module) and receives confirmations via the Webhooks module.

## Tables owned
- `business_transactions` — append-only ledger of all financial events affecting a business (top-ups, withdrawals, refunds, project charges).
- `consultant_transactions` — append-only ledger of all financial events affecting a consultant (credits, withdrawals, reversals). Replaced the former `wallet_transactions` table; FK now points to `consultant_profiles` instead of the deleted `consultant_wallets`.

Balance columns used (owned by profile modules, mutated here):
- `business_profiles.account_balance` — current business balance (numeric 15,2).
- `consultant_profiles.account_balance` — current consultant balance (numeric 15,2).

## Endpoints

### Shared — `PaymentsController` (`/payments`)
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/payments/withdraw` | `@Roles(USER)` | Withdraw to Stripe Connect. Resolves to `BusinessWithdrawStrategy` or `ConsultantWithdrawStrategy` based on `activePlatform`. |

### Business — `BusinessPaymentsController` (`/payments/business`)
| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/payments/business/top-up` | `@Roles(USER)` `@Platform(BUSINESS)` | Create a checkout session for balance deposit. |
| GET | `/payments/business/transactions` | `@Roles(USER)` `@Platform(BUSINESS)` | Paginated business transaction history. |

### Consultant — `ConsultantPaymentsController` (`/payments/consultant`)
| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/payments/consultant/transactions` | `@Roles(USER)` `@Platform(CONSULTANT)` | Paginated consultant transaction history. |

## Key invariants
- **Append-only ledger.** Never UPDATE a transaction row. To correct a completed withdrawal that later fails, insert a REVERSAL entry and credit the balance back (see Webhook section).
- **`processor_event_id` UNIQUE** on both transaction tables. Provides idempotency against webhook replays and duplicate Stripe transfer IDs.
- **Minimum withdrawal $50.** Enforced by `@Min(50)` on `CreateWithdrawDto.amount`. Applies to both roles.
- **Withdrawals always use Stripe Connect.** Even when `PAYMENT_PROCESSOR=polar`, the `createTransfer()` call routes to the Stripe provider because Polar does not support outbound transfers.
- **Top-ups use the active processor.** Controlled by `PAYMENT_PROCESSOR` env var (defaults to `'polar'`). Checkout sessions go through whichever provider the registry resolves.
- **Balance managed by app code, not DB triggers.** Deduction and crediting of `accountBalance` happen explicitly inside `uow.withTransaction()` blocks. The removed `trg_sync_wallet_balance` trigger is no longer used.
- **Stripe Connect inline check.** No separate `/connect` or `/connect/status` endpoints. The withdraw endpoint itself checks `stripeConnectAccountId`:
  - If null → returns `{ is_connected: false, onboarding_url }` (Stripe OAuth URL).
  - If present → validates balance, executes transfer, returns `{ transaction_id, status }`.
- **Separate transaction tables (not unified).** Business and consultant use different entities because:
  - Different owner FKs (`business_id` vs `consultant_id`) — no polymorphic associations.
  - Different type enums with different business semantics.
  - Consultant has `withdrawal_method` / `withdrawal_reference` columns (sparse NULLs for business).

## Design patterns

### Strategy — Withdraw
```
PaymentsController
  └─ PaymentsService.createWithdraw(dto)
       └─ getWithdrawStrategy()  ← resolves by requestContext.activePlatform
            ├─ BusinessWithdrawStrategy.execute(amount)
            │    └─ BusinessProfile → BusinessTransaction → PaymentService.createTransfer()
            └─ ConsultantWithdrawStrategy.execute(amount)
                 └─ ConsultantProfile → ConsultantTransaction → PaymentService.createTransfer()
```

### Strategy Factory — Payment Providers
```
PaymentService (common module)
  └─ PaymentProviderRegistry.getProvider(processor)
       ├─ PolarPaymentProvider   ← checkouts, webhooks
       └─ StripePaymentProvider  ← checkouts, webhooks, transfers
```
Active provider set by `PAYMENT_PROCESSOR` env var. Registry lazy-creates and caches instances.

## Payment flows

### Business Top-Up
```
1. POST /payments/business/top-up { amount, success_url, cancel_url }
2. Fetch businessProfile by userId
3. Insert BusinessTransaction (type: TOP_UP, status: PENDING)
4. PaymentService.createCheckoutSession() → processor redirect URL
5. Store processorEventId on transaction
6. Return { transaction_id, redirect_url }
   ─── user pays on processor's hosted page ───
7. Processor fires webhook (PAYMENT_SUCCEEDED / CHECKOUT_COMPLETED)
8. WebhookProcessor finds transaction by metadata.transactionId
9. Mark transaction COMPLETED
10. Credit businessProfile.accountBalance += amount
```

### Withdraw (Business or Consultant)
```
1. POST /payments/withdraw { amount }   (amount >= $50)
2. PaymentsService resolves strategy by activePlatform
3. Strategy fetches profile by userId

   ─── If stripeConnectAccountId is NULL ───
4a. Build Stripe OAuth onboarding URL
5a. Return { is_connected: false, onboarding_url }

   ─── If Stripe Connect linked ───
4b. Validate accountBalance >= amount
5b. BEGIN TRANSACTION:
    a. Insert transaction (type: WITHDRAW/WITHDRAWAL, status: PENDING)
    b. Deduct accountBalance (optimistic)
    c. PaymentService.createTransfer() → Stripe transfer ID
    d. Store processorEventId + mark COMPLETED
    COMMIT
6b. Return { is_connected: true, transaction_id, status: COMPLETED }

   ─── If Stripe transfer fails at API call time ───
    Transaction rolls back automatically (balance unchanged)
    Throw PAYMENT_TRANSFER_FAILED

   ─── If Stripe reports failure later (webhook: transfer.failed) ───
    WebhookProcessor finds transaction by processorEventId
    Mark transaction REVERSED
    Credit accountBalance += amount (restore deduction)
```

### Webhook: transfer.failed (Reversal)
```
1. Stripe fires transfer.failed event
2. WebhookProcessor extracts transfer ID from event data
3. Search business_transactions by processorEventId
   └─ If not found: search consultant_transactions
4. If already REVERSED → skip (idempotent)
5. Mark transaction REVERSED, note: "Transfer failed — reversed by webhook"
6. Credit profile.accountBalance += transaction.amount
```

## State machines
```
business_transactions:   PENDING → COMPLETED → (REVERSED via webhook)
                         PENDING → FAILED

consultant_transactions: PENDING → COMPLETED → (REVERSED via webhook)
                         PENDING → FAILED
```

Transaction types per table:

| Table | Type | Direction | Description |
|---|---|---|---|
| `business_transactions` | `top_up` | +balance | Deposit via checkout |
| | `withdraw` | −balance | Cash-out to Stripe Connect |
| | `refund` | +balance | Payment reversal |
| | `project_published` | −balance | Auto-charge on project publish |
| `consultant_transactions` | `credit_pending` | +pending | Earnings awaiting settlement |
| | `credit_cleared` | +balance | Earnings settled |
| | `debit_pending` | −pending | Clears pending entry |
| | `withdrawal` | −balance | Cash-out to Stripe Connect |
| | `reversal` | +balance | Failed withdrawal reversal |

## External dependencies
- **PaymentService (common module)** — `createCheckoutSession()` for top-ups, `createTransfer()` for withdrawals, `constructWebhookEvent()` for webhook verification.
- **BusinessProfiles** — `accountBalance` read/write, `stripeConnectAccountId` for Stripe Connect status.
- **ConsultantProfiles** — `accountBalance` read/write, `stripeConnectAccountId` for Stripe Connect status.
- **Webhooks** — `WebhookProcessorService` calls back into transaction tables to confirm payments and reverse failed transfers.
- **Billing** — invoices and line items produce `business_transactions` (invoice charges) and `consultant_transactions` (credits) during billing settlement.
- **EnvironmentsService** — `stripeConnectClientId`, `ployosUrl` (Stripe OAuth redirect), `polarTopUpProductId`.

## Critical edge cases
- **Optimistic balance deduction on withdraw.** Balance is deducted inside the DB transaction before the Stripe API call. If the Stripe call fails synchronously, the transaction rolls back — balance unchanged. If the Stripe call succeeds but Stripe later reports failure via `transfer.failed` webhook, the webhook handler reverses the deduction. Between the API success and the webhook, the balance is temporarily lower than the true state.
- **Race condition on concurrent withdrawals.** Two simultaneous withdrawals could both pass the balance check. Mitigation: `uow.withTransaction()` serializes writes to the profile row; the second transaction sees the deducted balance from the first.
- **Webhook replays.** `processorEventId` UNIQUE constraint prevents duplicate transaction inserts. The `handleTransferFailed` handler checks `status === REVERSED` before acting — idempotent on replay.
- **Polar does not support transfers.** `PolarPaymentProvider.createTransfer()` throws `NotImplementedException`. Withdrawals are Stripe-only regardless of `PAYMENT_PROCESSOR` setting.
- **Stripe Connect not linked.** The withdraw endpoint returns the onboarding URL inline instead of throwing. The client redirects the user to Stripe OAuth → callback → retry withdraw.
- **Partial balance after top-up webhook delay.** The top-up transaction stays `PENDING` until the webhook arrives. The business cannot spend the pending amount because `accountBalance` is only credited in the webhook handler, not at checkout creation time.
- **ConsultantTransaction replaces ConsultantWallet.** The old `consultant_wallets` table and `trg_sync_wallet_balance` trigger have been removed. Balance is managed via app-level deduction on `consultant_profiles.account_balance`, matching the business pattern.
