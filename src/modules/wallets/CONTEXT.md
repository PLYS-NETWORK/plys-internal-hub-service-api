# Wallets — Business Context

## Purpose
Owns each consultant's earnings ledger. Balances are derived from an append-only transaction log; the cached cleared/pending columns on the wallet exist purely as denormalized hot reads and are maintained exclusively by trigger.

## Tables owned
- `consultant_wallets` — one per consultant; cached cleared/pending balances + lifetime totals.
- `wallet_transactions` — append-only ledger.
- `v_wallet_balance_audit` — view comparing stored vs computed balances; alert if drift ≠ 0.

## Key invariants
- **Append-only ledger.** Never UPDATE a `wallet_transactions` row — insert a `reversal` instead.
- **Trigger-managed balances.** `trg_sync_wallet_balance` recomputes `consultant_wallets.cleared_balance` / `pending_balance` after every transaction. **Never UPDATE the cached columns from app code** — they will drift.
- **No `>= 0` CHECK on `cleared_balance`.** §C2 fix — chargebacks/reversals can take the balance negative. Withdrawal validation enforces non-negative result at the service layer using `TranslatableException`.
- **`processor_event_id` UNIQUE.** Provides idempotency for webhook-triggered transactions.
- **Transaction types & sign:**
  - `credit_pending` (+pending) — invoice issued, funds reserved
  - `credit_cleared` (+cleared) — payment confirmed
  - `debit_pending` (-pending) — clears the corresponding pending entry
  - `withdrawal` (-cleared) — consultant cash-out
  - `reversal` (-cleared) — chargeback / dispute
- **Audit drift check.** Daily job: `SELECT * FROM v_wallet_balance_audit WHERE cleared_drift <> 0 OR pending_drift <> 0` — if non-empty, ledger and cache are out of sync. Investigate immediately.

## State machines
None — transactions have a `status` field but lifecycle is essentially `completed | reversed`. Wallets themselves are append-grown.

## External dependencies
- **Billing** — invoice creation writes `credit_pending`; payment confirmation writes `credit_cleared` + `debit_pending`.
- **Tasks** — task ID stamped on each transaction for traceability.
- **WebhookEvents** — payment confirmations originate here.
- **Notifications** — wallet credited → consultant.
- **External: Stripe / Polar** — withdrawals also call out to a payout provider; reference stored in `withdrawal_reference`.

## Critical edge cases
- **Webhook replays.** `processor_event_id` UNIQUE on inserts is the gate — second insert errors with 23505, which the service layer catches and treats as success (event already processed).
- **Negative cleared balance.** Possible after chargeback. Service layer must NOT allow withdrawals when `cleared_balance < amount`.
- **Bulk credit on a paid invoice.** Inside one transaction: insert all `credit_cleared` rows + matching `debit_pending` rows; the trigger increments balances atomically.
- **Reversing a withdrawal already paid out.** Bank-side issue. Insert a `reversal` of the appropriate amount and reconcile manually.
- **Pending balance never goes negative** in normal flow, but `debit_pending` + missing `credit_pending` would underflow — assert pairing in the service layer (no DB CHECK).
