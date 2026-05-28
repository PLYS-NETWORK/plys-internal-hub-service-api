# Domain Ownership

This document defines **bounded contexts**, table ownership, and module boundaries after splitting the former **profiles-service** and **projects-service** into domain-aligned microservices.

During the shared-PostgreSQL phase, multiple services read the same schema through TypeORM; **write ownership** below is the rule for new code and migrations.

---

## Bounded contexts (10 services)

| Service                            | Bounded context     | Owns (summary)                                                                                                             |
| ---------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **identity-service**               | Identity & access   | `users`, `user_sessions`, `auth_tokens`, admin OTP, allowed emails                                                         |
| **business-service**               | Business (Ployos)   | Business profiles, business onboarding, projects/tasks (business side), board, backlogs, AI sync, business dashboard stats |
| **consultant-service**             | Consultant (Lonaos) | Consultant profiles, onboarding, skill exams, explore, membership, consultant tasks, consultant dashboard stats            |
| **internal-admin-service**         | Internal admin      | Admin onboarding questions, consultant onboarding review, skill exam admin, project AI context (admin), admin statistics   |
| **internal-task-reviewer-service** | Task review         | Task review rounds, votes, reviewer assignment, completion payout orchestration                                            |
| **finance-service**                | Finance             | Wallets, transactions, billing periods/invoices, payment webhooks                                                          |
| **notifications-service**          | Notifications       | `notifications` persistence, domain event handlers, skill-match fan-out                                                    |
| **platform-service**               | Platform (slim)     | Files, skills catalog, housekeeping jobs, health                                                                           |
| **ai-provider-service**            | AI provider         | AI provider keys (vault), chat sessions, project AI context (runtime), AI bootstrap                                        |
| **api-gateway**                    | Edge                | No tables — HTTP/WS only                                                                                                   |

Legacy **`profiles-service`** / **`projects-service`** are decommissioned; their modules were distributed into the rows above.

---

## Table ownership

| Table(s)                                                                          | Owner service                                                                            | Consumers                                                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `users`, `user_sessions`, `auth_*`                                                | identity-service                                                                         | All (read via JWT / UoW where needed)                                                  |
| `business_profiles`                                                               | business-service                                                                         | finance-service (ledger), internal-admin (read)                                        |
| `consultant_profiles`, `consultant_skills`                                        | consultant-service                                                                       | business-service (skill match reads), finance-service                                  |
| `consultant_onboardings`, `consultant_onboarding_answers`, `onboarding_questions` | consultant-service (consultant flow) / internal-admin-service (admin CRUD for questions) | identity-service (register gate)                                                       |
| `consultant_skill_exams`, `consultant_skill_exam_*`, `consultant_skill_scores`    | consultant-service                                                                       | internal-admin-service (admin review)                                                  |
| `projects`, `project_*`, `tasks`, `task_*`, `task_history`                        | business-service (business mutations) / consultant-service (consultant mutations)        | internal-task-reviewer-service, ai-provider-service, internal-admin-service            |
| `project_ai_context`, `chat_sessions`, `chat_messages`                            | ai-provider-service (runtime) / business-service (AI sync writes)                        | api-gateway BFF                                                                        |
| `ai_provider_keys`                                                                | ai-provider-service (`modules/ai-provider-key`)                                          | api-gateway admin/BFF via gRPC; crypto in `@plys/libraries/common-nest/crypto/ai-keys` |
| `business_transactions`, `consultant_transactions` (project-scoped)               | business-service / consultant-service / finance-service per flow                         | See [transaction-inventory.md](./transaction-inventory.md)                             |
| `billing_periods`, `invoices`, `webhook_events`                                   | finance-service                                                                          | —                                                                                      |
| `notifications`                                                                   | notifications-service                                                                    | api-gateway (WS), domain services via `NotificationsClientModule` gRPC                 |
| `files`, `skills`                                                                 | platform-service                                                                         | All upload/download paths via gRPC                                                     |

**Rule:** The owner performs authoritative writes; consumers use **gRPC**, **ports** (`@plys/libraries/profiles-port`), or read-only UoW in the same transaction only inside [composite flows](./transaction-inventory.md).

---

## Module boundaries by service

### business-service

| Module area                  | Owns                                             | Must not                          |
| ---------------------------- | ------------------------------------------------ | --------------------------------- |
| `profiles/`                  | Business profile CRUD                            | Import consultant-only modules    |
| `business-onboarding/`       | Business onboarding                              | —                                 |
| `business-projects/`         | Projects, board, backlogs, settings, attachments | Direct consultant task completion |
| `project-ai-context/` (sync) | AI sync side effects                             | AI key vault                      |
| `statistics/`                | Business dashboard aggregates                    | —                                 |

**UoW:** `AppUnitOfWorkModule` → `ProfilesUnitOfWorkModule`, `ProjectsUnitOfWorkModule`.

### consultant-service

| Module area              | Owns                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `profiles/`              | Consultant profile CRUD                                                             |
| `consultant-onboarding/` | Interview Q&A                                                                       |
| `consultant-skill-exam/` | Exams + Bull AI pipeline                                                            |
| `consultant-projects/`   | Membership, tasks, joined projects                                                  |
| `explore/`               | Published project discovery                                                         |
| `statistics/`            | Consultant dashboard                                                                |
| `task-reviews/`          | Legacy/consultant-side helpers (prefer internal-task-reviewer for review authority) |

**UoW:** `ProfilesUnitOfWorkModule` + `ProjectsUnitOfWorkModule` via `AppUnitOfWorkModule`.

### internal-admin-service

| Module area                    | Owns                       |
| ------------------------------ | -------------------------- |
| `admin-onboarding-questions/`  | Question bank CRUD         |
| `admin-consultant-onboarding/` | Approve/reject onboarding  |
| `admin-consultant-skill-exam/` | Exam review                |
| `project-ai-context/`          | Admin AI context overrides |
| `statistics/`                  | Admin dashboard metrics    |

**UoW:** `ProfilesUnitOfWorkModule`, `ProjectsUnitOfWorkModule`, `UnitOfWorkModule`.

### internal-task-reviewer-service

| Module area     | Owns                                  |
| --------------- | ------------------------------------- |
| `task-reviews/` | Review rounds, voting, payout trigger |

**UoW:** `AppUnitOfWorkModule` (projects + profiles ports for ledger).

### finance-service

| Module area | Owns                           |
| ----------- | ------------------------------ |
| `payments/` | Top-up, withdraw, Stripe/Polar |
| `billing/`  | Invoices, settlement           |
| `webhooks/` | Webhook ingest + Bull workers  |

### notifications-service

| Module area      | Owns                                    |
| ---------------- | --------------------------------------- |
| `notifications/` | CRUD, event handlers, skill-match queue |

### platform-service (slim)

| Module area     | Owns                   |
| --------------- | ---------------------- |
| `files/`        | Upload, storage, quota |
| `skills/`       | Skill catalog          |
| `housekeeping/` | Scheduled jobs         |

**Removed from platform** (moved out): notifications implementation, business/consultant statistics, project/task domains.

### ai-provider-service

| Module area             | Owns                                           |
| ----------------------- | ---------------------------------------------- |
| `project-chat-session/` | Sessions & messages                            |
| `project-ai-context/`   | Derived context, decision log                  |
| `ai-bootstrap/`         | FE bootstrap payload                           |
| `ai-provider-key/`      | Key vault admin CRUD + BFF active-key endpoint |

### identity-service

| Module area                      | Owns                                      |
| -------------------------------- | ----------------------------------------- |
| `auth/`, `users/`, `admin-auth/` | Login, register, SSO, sessions, admin OTP |

---

## Packages and ports

| Package                                                    | Purpose                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `@plys/libraries/profiles-port`                            | `IProfilesReader`, `IProfilesLedger` — cross-service balance/profile reads |
| `@plys/libraries/common-nest/modules/notifications-client` | gRPC client for cross-service notification emit/dispatch                   |
| `@plys/libraries/common-nest/crypto/ai-keys`               | `MasterKeyCipher`, `BffEnvelopeCipher` for AI key storage                  |
| `@plys/libraries/transaction-coordinator`                  | `SharedDbTransactionCoordinator` for composite SQL                         |
| `ProfilesUnitOfWorkModule` / `ProjectsUnitOfWorkModule`    | Repository bundles in `packages/unit-of-work/`                             |

---

## Compile-time coupling rules

- `apps/*/**` must **not** import from another app's `src/` (ESLint `no-restricted-imports`).
- All apps may import from `packages/**`.
- api-gateway imports **only** gRPC clients + HTTP controllers under `http/v1/` — not domain service implementations.
- api-gateway must not import `*Service` classes from `@modules/*`; enforce with `pnpm run check:gateway-boundary`.
- Non-gateway app controllers are internal gRPC delegates (thin wrappers). Edge concerns (JWT/RBAC/platform/throttle/Swagger) are owned by api-gateway.

---

## Related docs

| Document                                               | Topic                                         |
| ------------------------------------------------------ | --------------------------------------------- |
| [system-architecture.md](./system-architecture.md)     | Topology, gateway layout, EnvironmentsService |
| [transaction-inventory.md](./transaction-inventory.md) | Who owns composite SQL flows                  |
