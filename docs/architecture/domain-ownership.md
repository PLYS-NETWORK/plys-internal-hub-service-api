# Domain Ownership

This document defines table ownership and module boundaries for the **profiles-service** and **projects-service** bounded contexts. Cross-context data access in projects-service goes through `@plys/profiles-port` (SharedDbProfilesAdapter today; gRPC adapter later).

## Table ownership

| Table(s)                                                                          | Owner service    | Consumer (via port)          |
| --------------------------------------------------------------------------------- | ---------------- | ---------------------------- |
| `business_profiles`                                                               | profiles-service | projects-service             |
| `consultant_profiles`                                                             | profiles-service | projects-service             |
| `consultant_skills`, `skills`                                                     | profiles-service | projects-service (read-only) |
| `consultant_onboardings`, `consultant_onboarding_answers`, `onboarding_questions` | profiles-service | —                            |
| `consultant_skill_exams`, `consultant_skill_exam_*`, `consultant_skill_scores`    | profiles-service | —                            |
| `projects`, `project_*`, `tasks`, `task_*`                                        | projects-service | —                            |
| `business_transactions`, `consultant_transactions` (project-scoped writes)        | projects-service | —                            |
| `users`, `auth_*`                                                                 | identity-service | both (read via UoW)          |

Composite transactions (`confirmPublish`, `payTasks`, task-completion payout) remain in **projects-service** — the profiles ledger adapter participates in the same PostgreSQL transaction via `ProfilesTx`.

## Module boundaries — profiles-service

| Module                   | Owns                             | Must not import  |
| ------------------------ | -------------------------------- | ---------------- |
| `profiles/`              | Business/consultant profile CRUD | projects modules |
| `business-onboarding/`   | Business onboarding flow         | projects modules |
| `consultant-onboarding/` | Interview Q&A                    | projects modules |
| `consultant-skill-exam/` | Skill exams + AI eval            | projects modules |
| `admin-*`                | Admin CRUD                       | projects modules |

Shared package: `@plys/ai-provider-key` (not projects-service).

## Module boundaries — projects-service

| Module                                      | Owns                                        | Profile access                        |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| `business-projects/`                        | Business project lifecycle, board, backlogs | `PROFILES_READER` / `PROFILES_LEDGER` |
| `consultant-projects/`                      | Consultant discovery, membership, tasks     | `PROFILES_READER`                     |
| `task-reviews/`                             | 3+1 review, completion payout               | `PROFILES_READER` / `PROFILES_LEDGER` |
| `explore/`, `ai-*`, `project-chat-session/` | Project-scoped features                     | projects UoW only                     |

## Packages

| Package                    | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `@plys/profiles-port`      | `IProfilesReader`, `IProfilesLedger`, DI tokens |
| `@plys/ai-provider-key`    | AI provider key CRUD + BFF envelope (shared)    |
| `ProfilesUnitOfWorkModule` | Profile-domain repos (profiles-service)         |
| `ProjectsUnitOfWorkModule` | Project-domain repos (projects-service)         |

## Compile-time coupling rules

- `apps/profiles-service/**` must **not** import from `apps/projects-service/**`
- `apps/projects-service/**` must **not** import from `apps/profiles-service/**`
- Both may import from `packages/**`

Enforced via ESLint `no-restricted-imports` on both apps.
