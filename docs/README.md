# Documentation

Backend documentation for the Plys internal hub API monorepo (Nx + NestJS, 10 services, shared PostgreSQL).

---

## API (frontend contracts)

| Doc                                                | Description                                         |
| -------------------------------------------------- | --------------------------------------------------- |
| [api/common-response.md](./api/common-response.md) | `StandardizedResponse` success and error envelopes  |
| [api/error-codes.md](./api/error-codes.md)         | Stable `errorCode` catalog with HTTP status mapping |

---

## Architecture

| Doc                                                                              | Description                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [architecture/system-architecture.md](./architecture/system-architecture.md)     | 10-service topology, gateway `http/v1/`, gRPC, EnvironmentsService, packages                      |
| [architecture/domain-ownership.md](./architecture/domain-ownership.md)           | Bounded contexts: business, consultant, internal-admin, notifications, ai-provider, slim platform |
| [architecture/transaction-inventory.md](./architecture/transaction-inventory.md) | `SharedDbTransactionCoordinator` and composite flow owners                                        |
| [architecture/versioning.md](./architecture/versioning.md)                       | `@plys/libraries` Changesets + HTTP API v1 folder layout                                          |

---

## Deployment

| Doc                                                | Description                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| [deployment/overview.md](./deployment/overview.md) | 10 services, `env/` + `docker/`, `IMAGE_TAG_*`, gRPC 5001–5009, PM2 |
| [deployment/setup.md](./deployment/setup.md)       | First-time VPS and GitHub setup                                     |

---

## Integration

| Doc                                                            | Description                  |
| -------------------------------------------------------------- | ---------------------------- |
| [integration/ai-chat-flows.md](./integration/ai-chat-flows.md) | AI chat frontend integration |

---

## API specs (per endpoint)

OpenAPI-style endpoint specs grouped by **gRPC service** (mirrors `apps/`):

| Folder                                                                                   | Service                                      |
| ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| [api-specs/business-service/](./api-specs/business-service/)                             | Ployos (business profiles, projects)         |
| [api-specs/consultant-service/](./api-specs/consultant-service/)                         | Lonaos (consultant profiles, explore, tasks) |
| [api-specs/identity-service/](./api-specs/identity-service/)                             | Auth, SSO, admin OTP                         |
| [api-specs/internal-admin-service/](./api-specs/internal-admin-service/)                 | Internal Hub admin operations                |
| [api-specs/internal-task-reviewer-service/](./api-specs/internal-task-reviewer-service/) | Task review workflow                         |
| [api-specs/finance-service/](./api-specs/finance-service/)                               | Payments, wallets, billing                   |
| [api-specs/notifications-service/](./api-specs/notifications-service/)                   | Notifications REST + realtime                |
| [api-specs/platform-service/](./api-specs/platform-service/)                             | Files, skills                                |
| [api-specs/ai-provider-service/](./api-specs/ai-provider-service/)                       | AI keys, chat, context                       |
| [api-specs/api-gateway/](./api-specs/api-gateway/)                                       | Cross-cutting gateway concerns (idempotency) |

---

## Quick links

| Topic                | Location                                                       |
| -------------------- | -------------------------------------------------------------- |
| Env templates        | `env/.env.example`, `env/.env.dev`, `env/.env.prod`            |
| Local Docker stack   | `docker/docker-compose.yml` + `docker/docker-compose.apps.yml` |
| Agent / coding rules | `aidocs/`, `.cursor/rules/`                                    |
| Root README          | [../README.md](../README.md)                                   |
