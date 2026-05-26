# Plys Marketplace Monorepo

Backend for a two-sided marketplace connecting **businesses** (project owners on **Ployos**) and **consultants** (freelance professionals on **Lona**).

This repository is an **Nx + pnpm monorepo**. The HTTP edge is `apps/api-gateway`; domain logic runs in five gRPC microservices. Shared code lives in `@plys/libraries` under `packages/`.

---

## Tech Stack

| Layer             | Technology                                           |
| ----------------- | ---------------------------------------------------- |
| Runtime           | Node.js 20 LTS                                       |
| Monorepo          | pnpm workspaces + Nx 20                              |
| Framework         | NestJS 11 (Fastify adapter on the gateway)           |
| Language          | TypeScript 5                                         |
| Inter-service RPC | gRPC (`@nestjs/microservices`, `@grpc/grpc-js`)      |
| Database          | PostgreSQL 16                                        |
| ORM               | TypeORM 0.3                                          |
| Cache / queues    | Redis 7+ (ioredis, Bull, throttling)                 |
| Auth              | JWT (access + refresh), Google OAuth 2.0 (SSO)       |
| Realtime          | Socket.io (notifications via platform-service)       |
| Email             | Resend                                               |
| Payments          | Polar or Stripe (configurable)                       |
| File storage      | Local disk or AWS S3                                 |
| AI                | OpenAI, Groq, Google Generative AI                   |
| Validation        | class-validator + class-transformer                  |
| API docs          | Swagger / OpenAPI (`@nestjs/swagger`)                |
| i18n              | nestjs-i18n — English (`en`) and Turkish (`tr`)      |
| Logging           | Winston (`nest-winston`)                             |
| Containerization  | Docker + Docker Compose                              |
| CI/CD             | GitHub Actions → GHCR → VPS (PM2 supervises compose) |
| Versioning        | Changesets (`@plys/libraries`)                       |

---

## Project Architecture

### High-level flow

Clients (Ployos / Lona frontends) talk only to the **API gateway** over REST and WebSocket. The gateway forwards requests to backend services over **gRPC**. All services share one PostgreSQL schema and Redis cluster during the current migration phase.

```mermaid
flowchart LR
  Client[Browser / FE BFF] --> Gateway[api-gateway<br/>HTTP :3000]
  Gateway --> Identity[identity-service<br/>gRPC :5001]
  Gateway --> Profiles[profiles-service<br/>gRPC :5002]
  Gateway --> Projects[projects-service<br/>gRPC :5003]
  Gateway --> Finance[finance-service<br/>gRPC :5004]
  Gateway --> Platform[platform-service<br/>gRPC :5005]
  Identity --> PG[(PostgreSQL)]
  Profiles --> PG
  Projects --> PG
  Finance --> PG
  Platform --> PG
  Identity --> Redis[(Redis)]
  Profiles --> Redis
  Projects --> Redis
  Finance --> Redis
  Platform --> Redis
```

### Services

| Service            | Port        | Responsibility                                                               |
| ------------------ | ----------- | ---------------------------------------------------------------------------- |
| `api-gateway`      | 3000 (HTTP) | REST edge, JWT/session context, rate limiting, Swagger, gRPC client dispatch |
| `identity-service` | 5001        | Auth, SSO, sessions, users, admin auth                                       |
| `profiles-service` | 5002        | Business/consultant profiles, onboarding, skill exams                        |
| `projects-service` | 5003        | Projects, tasks, explore, AI context, chat sessions, task reviews            |
| `finance-service`  | 5004        | Wallets, payments, billing, payment webhooks                                 |
| `platform-service` | 5005        | Files, skills taxonomy, statistics, notifications, health                    |

Compile-time coupling between `profiles-service` and `projects-service` is forbidden; cross-context reads go through `@plys/libraries/profiles-port`. See [docs/architecture/domain-ownership.md](docs/architecture/domain-ownership.md).

### Monorepo layout

```
apps/
├── api-gateway/           # HTTP + WebSocket edge (no direct DB access)
├── identity-service/      # gRPC — auth domain
├── profiles-service/      # gRPC — profiles domain
├── projects-service/      # gRPC — projects domain
├── finance-service/       # gRPC — finance domain
└── platform-service/      # gRPC — platform domain

packages/                  # @plys/libraries (single package, subpath exports)
├── proto/                 # gRPC .proto contracts
├── database/              # TypeORM entities, migrations, seeds
├── config/                # Env file resolution, typed configuration
├── common-nest/           # Guards, filters, interceptors, shared Nest modules
├── unit-of-work/          # Repository layer + domain UoW modules
├── shared-kernel/         # Cross-service constants
├── ai-provider-key/       # AI provider key CRUD + BFF envelope
└── profiles-port/         # Profiles reader/ledger port interfaces

docker-compose.yml         # Local postgres + redis
docker-compose.apps.yml    # Full local stack in Docker
Dockerfile                 # Multi-target build (6 services + migrate)
```

Import shared code via subpaths, e.g. `@plys/libraries/database`, `@plys/libraries/common-nest/guards/jwt-auth.guard`.

### Key design patterns

- **Unit of Work** — repository access goes through `UnitOfWorkService` (or domain-specific UoW modules). Services do not inject TypeORM repositories directly. Transactions use `uow.withTransaction(...)`.
- **Request context** — `RequestContextService` (AsyncLocalStorage) holds user identity (`userId`, `userRole`, `activePlatform`). No `@CurrentUser()` decorator; no `userId` parameters passed between layers.
- **Two-platform model** — `ActivePlatform.BUSINESS` (Ployos) and `ActivePlatform.CONSULTANT` (Lona). `PlatformGuard` enforces platform scope per endpoint.
- **Standardized response** — `TransformResponseInterceptor` wraps every HTTP response in `{ status_code, message, error_code, data, timestamp, path }`. Controllers return `{ messageKey, data }`.
- **snake_case API** — JSON keys use `snake_case`. `@Expose({ name: 'camelKey' })` maps entity properties at the HTTP boundary.
- **i18n keys in DB** — skill names, categories, and industries are stored as i18n keys (e.g. `skill_react`). Translation happens per request locale.

### Further reading

| Doc                                                                            | Contents                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------- |
| [docs/README.md](docs/README.md)                                               | Documentation index                           |
| [docs/deployment/overview.md](docs/deployment/overview.md)                     | Docker, env files, CI/CD, PM2 per-service ops |
| [docs/deployment/setup.md](docs/deployment/setup.md)                           | First-time VPS + GitHub setup guide           |
| [docs/architecture/domain-ownership.md](docs/architecture/domain-ownership.md) | Table ownership and bounded contexts          |
| [docs/architecture/versioning.md](docs/architecture/versioning.md)             | `@plys/libraries` semver via Changesets       |

---

## Setup Guide

### Requirements

| Tool       | Version                          |
| ---------- | -------------------------------- |
| Node.js    | 20.x LTS (`>=20.0.0`)            |
| pnpm       | 9.x (`>=9.0.0`)                  |
| Docker     | For PostgreSQL and Redis locally |
| PostgreSQL | 16 (via Docker Compose)          |
| Redis      | 7+ (via Docker Compose)          |

Install pnpm if needed:

```bash
npm install -g pnpm
```

### 1. Clone and install

```bash
git clone <repo-url>
cd plys-internal-hub-serivce-api
pnpm install
```

### 2. Configure environment

Env files live at the **repo root** and are shared by all apps.

```bash
cp .env.example .env.local
```

Fill in secrets in `.env.local`. Key variables:

| Variable               | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `DEPLOY_ENV=local`     | Selects `.env.local` at runtime                             |
| `NODE_ENV=development` | Node runtime mode                                           |
| `DB_*`                 | PostgreSQL connection (defaults match `docker-compose.yml`) |
| `REDIS_*`              | Redis connection                                            |
| `JWT_*`                | Access/refresh token secrets                                |
| `*_GRPC_URL`           | gRPC addresses for each backend service                     |

See [.env.example](.env.example) for the full list. Committed templates: `.env.dev`, `.env.prod` (used on VPS). Never commit `.env.local`.

### 3. Start infrastructure

**Postgres + Redis only** (recommended for Nx serve):

```bash
docker compose up -d
```

**Full stack in Docker** (all 6 services + infra):

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml up --build
```

### 4. Run database migrations

```bash
pnpm migration:run
```

### 5. Seed reference data

Seeds the skills taxonomy (ESCO-sourced) and admin allow-list. Safe to re-run (upsert semantics).

```bash
pnpm db:seed
```

In Docker deploys, the `migrate` image target runs migrations and seeds automatically.

To wipe the local schema (tables only, `DEPLOY_ENV=local` required):

```bash
pnpm db:drop
pnpm migration:run
```

### 6. Start services

**Option A — Nx serve** (hot reload, recommended for development):

```bash
docker compose up -d   # postgres + redis
nx run identity-service:serve   # gRPC :5001
nx run profiles-service:serve   # gRPC :5002
nx run projects-service:serve   # gRPC :5003
nx run finance-service:serve    # gRPC :5004
nx run platform-service:serve   # gRPC :5005
nx run api-gateway:serve        # HTTP :3000
```

Or start all at once:

```bash
nx run-many -t serve --projects=identity-service,profiles-service,projects-service,finance-service,platform-service,api-gateway
```

**Option B — Production build**:

```bash
pnpm build
DEPLOY_ENV=local NODE_ENV=production node apps/api-gateway/dist/main.js
```

### 7. Verify

| Endpoint   | URL                               |
| ---------- | --------------------------------- |
| API base   | http://localhost:3000/api/v1      |
| Swagger UI | http://localhost:3000/api/v1/docs |

---

## Development Commands

| Command                                        | Description                                       |
| ---------------------------------------------- | ------------------------------------------------- |
| `pnpm build`                                   | Build all apps and `@plys/libraries`              |
| `pnpm lint`                                    | ESLint across all Nx projects                     |
| `pnpm test`                                    | Run all unit tests                                |
| `pnpm format`                                  | Prettier on `apps/` and `packages/`               |
| `pnpm affected`                                | Lint, test, and build only affected projects      |
| `nx graph`                                     | Visualize project dependency graph                |
| `pnpm migration:generate --name=MigrationName` | Generate a new TypeORM migration                  |
| `pnpm migration:revert`                        | Revert the last applied migration                 |
| `pnpm db:seed`                                 | Seed skills taxonomy and admin allow-list (local) |
| `pnpm db:drop`                                 | Drop and recreate `public` schema (local only)    |
| `nx run api-gateway:serve`                     | Start the HTTP gateway with hot reload            |
| `nx run <service>:serve`                       | Start a single gRPC microservice                  |

---

## License

UNLICENSED — private repository.
