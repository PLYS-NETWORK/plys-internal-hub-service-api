# Wallets — Business Context

> **Superseded.** The `consultant_wallets` table, `wallet_transactions` table, and `trg_sync_wallet_balance` trigger have been removed. Consultant earnings are now tracked in `consultant_transactions` (FK to `consultant_profiles`) and balance is managed via app-level deduction on `consultant_profiles.account_balance`. See `src/modules/payments/CONTEXT.md` for the current design.
