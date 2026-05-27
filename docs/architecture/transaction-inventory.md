# Composite SQL Transactions (Monorepo Migration)

During phases 0–5 (shared PostgreSQL), any flow that today uses a single
`UnitOfWorkService.withTransaction()` must remain **one transaction in one service process**.

Cross-service gRPC calls must **not** split these flows until DB-per-service (Phase 6).

| Flow                              | Owner service    | Key tables                                            |
| --------------------------------- | ---------------- | ----------------------------------------------------- |
| `auth.register` / SSO first login | identity-service | `users`, profiles, `auth_tokens`                      |
| `auth.refresh`                    | identity-service | `user_sessions` (pessimistic lock)                    |
| `projects.pay_tasks`              | projects-service | `business_profiles`, `tasks`, `business_transactions` |
| `projects.ai_sync_tasks`          | projects-service | `tasks`, `task_history`, `project_ai_context`         |
| `finance.top_up` / withdraw       | finance-service  | transactions, profile balance                         |
| `finance.billing_settlement`      | finance-service  | `billing_periods`, `invoices`, ledger                 |
| `finance.webhook_processing`      | finance-service  | `webhook_events`, invoices, balances                  |

See the monorepo refactor plan for full rules and Phase 6 saga migration notes.
