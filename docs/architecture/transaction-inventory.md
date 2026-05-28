# Composite SQL Transactions

During the **shared PostgreSQL** phase, any flow that must be atomic across repositories (or ports) stays in **one database transaction in one owning service process**. Cross-service gRPC calls must **not** split these flows until database-per-service (future saga phase).

Orchestration uses:

- **`SharedDbTransactionCoordinator`** (`packages/transaction-coordinator/shared-db-transaction.coordinator.ts`) — starts a TypeORM `QueryRunner` transaction and passes `EntityManager` to participating work.
- **`COMPOSITE_FLOW_REGISTRY`** (`packages/transaction-coordinator/composite-flow.registry.ts`) — documents flow id, owner service, and participating ports.
- **`COMPOSITE_TRANSACTION_FLOWS`** (`packages/database/composite-transactions.ts`) — canonical flow name constants.

```typescript
await this.coordinator.run('projects.pay_tasks', 'business-service', async (manager) => {
  // profiles port + task repos share `manager`
});
```

Participating ports receive the same `EntityManager` via `withManager()` so ledger and task writes commit or roll back together.

---

## Flow inventory

| Flow                         | Owner service    | Participating ports / repos           | Key tables                                                           |
| ---------------------------- | ---------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `auth.register`              | identity-service | `profiles.createProfile`              | `users`, business/consultant profile rows, `auth_tokens`             |
| `auth.sso_first_login`       | identity-service | `profiles.createProfile`              | Same as register on first SSO login                                  |
| `projects.pay_tasks`         | business-service | `profiles.ledger`, `tasks.pay`        | `business_profiles`, `tasks`, `business_transactions`                |
| `projects.ai_sync_tasks`     | business-service | `tasks.sync`, `ai.context`            | `tasks`, `task_history`, `project_ai_context`                        |
| `finance.top_up`             | finance-service  | `profiles.ledger`                     | Profile balance, `business_transactions` / `consultant_transactions` |
| `finance.withdraw`           | finance-service  | `profiles.ledger`                     | Balances, pending transactions                                       |
| `finance.billing_settlement` | finance-service  | `profiles.ledger`, `billing.invoices` | `billing_periods`, `invoices`, ledger                                |
| `finance.webhook_processing` | finance-service  | `profiles.ledger`, `billing.invoices` | `webhook_events`, invoices, balances                                 |

---

## Owner service reference

| Service          | Composite flows owned                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| identity-service | `auth.register`, `auth.sso_first_login`                                                          |
| business-service | `projects.pay_tasks`, `projects.ai_sync_tasks`                                                   |
| finance-service  | `finance.top_up`, `finance.withdraw`, `finance.billing_settlement`, `finance.webhook_processing` |

**internal-task-reviewer-service** runs task-completion payout logic inside its process using the same coordinator pattern where profile ledger and task state must commit together (task review completion — see service `task-completion` / payout modules).

**consultant-service** does not own a registered composite flow name today; multi-step exam/onboarding writes use local `UnitOfWorkService.withTransaction()` within the service only.

---

## Rules (shared DB phase)

1. **Do not** open a transaction in service A and call gRPC to service B expecting B's writes to join A's transaction.
2. **Do** use `SharedDbTransactionCoordinator` + in-process ports (`SharedDbProfilesAdapter`, etc.) when a flow spans profile ledger and project/finance tables.
3. **Do** keep flow names in sync: add to `COMPOSITE_TRANSACTION_FLOWS`, `COMPOSITE_FLOW_REGISTRY`, and this document.
4. **Phase 6 (future):** replace cross-aggregate flows with sagas/outbox; until then, expanding composite flows requires same-DB participation only.

---

## Local single-service transactions

Most service methods still use `UnitOfWorkService.withTransaction()` for single-context atomicity (one aggregate). Those are not listed here unless they span ports listed in the registry.

---

## Related docs

| Document                                           | Topic                             |
| -------------------------------------------------- | --------------------------------- |
| [domain-ownership.md](./domain-ownership.md)       | Which service owns which tables   |
| [system-architecture.md](./system-architecture.md) | `transaction-coordinator` package |
