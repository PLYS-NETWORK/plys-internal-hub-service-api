# API Gateway Service

Backend REST API for a two-sided marketplace platform connecting **businesses** (project owners) and **consultants** (freelance professionals).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 11 (Fastify adapter) |
| Language | TypeScript 5 |
| Database | PostgreSQL 15+ |
| ORM | TypeORM 0.3 |
| Cache | Redis 7+ (ioredis) |
| Auth | JWT (access + refresh tokens), Google OAuth 2.0 (SSO) |
| Email | Resend |
| Payments | Polar or Stripe (configurable) |
| Validation | class-validator + class-transformer |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| i18n | nestjs-i18n — English (`en`) and Turkish (`tr`) |
| Package Manager | pnpm |

---

## Architecture Overview

```
src/
├── common/                 # Shared infrastructure
│   ├── constants/          # Error codes, app-wide constants
│   ├── decorators/         # @Roles, @Platform, @Public
│   ├── exceptions/         # TranslatableException, GlobalExceptionFilter
│   ├── guards/             # JwtAuthGuard, RolesGuard, PlatformGuard
│   ├── interceptors/       # TransformResponseInterceptor (standardized envelope)
│   ├── middleware/         # RequestContextMiddleware, JwtContextMiddleware
│   ├── modules/
│   │   ├── environments/   # EnvironmentsService — typed config access
│   │   ├── redis/          # RedisService — ioredis wrapper (global)
│   │   └── request-context/ # AsyncLocalStorage — request identity propagation
│   └── repositories/       # AbstractRepository<T> base class
│
├── database/
│   ├── entities/           # TypeORM entities (single source of truth)
│   │   ├── auth/           # User, UserSession, AuthToken, UserSsoProvider
│   │   ├── base/           # AuditableEntity, TraceableEntity
│   │   ├── profiles/       # BusinessProfile, ConsultantProfile, Skill, ConsultantSkill
│   │   └── projects/       # Project, ProjectRequiredSkill, ProjectStatusHistory, …
│   ├── enums/              # ProjectStatus, UserRole, ActivePlatform, …
│   ├── migrations/         # TypeORM migration files
│   └── seeds/              # Seed runner — skills taxonomy (ESCO-sourced)
│
└── modules/
    ├── auth/               # JWT auth, SSO, email verification, password reset
    ├── business-profiles/  # Business onboarding and profile management
    ├── consultant-profiles/ # Consultant onboarding, skills, verification
    ├── projects/           # Project CRUD (business), project discovery (consultant)
    ├── skills/             # Read-only skills taxonomy with Redis cache
    └── unit-of-work/       # UnitOfWorkService + all TypeORM repositories
```

### Key Design Patterns

- **Unit of Work** — all repository access goes through `UnitOfWorkService`. Services never inject TypeORM repositories directly. Transactions are managed via `uow.withTransaction(...)`.
- **Request Context** — `RequestContextService` (AsyncLocalStorage) is the single source of user identity (`userId`, `userRole`, `activePlatform`). No `@CurrentUser()` decorator; no `userId` parameters between layers.
- **Two-Platform Model** — `ActivePlatform.BUSINESS` (Ployos) and `ActivePlatform.CONSULTANT` (Lona). `PlatformGuard` enforces which platform each endpoint belongs to.
- **Standardized Response** — `TransformResponseInterceptor` wraps every response in `{ status_code, message, error_code, data, timestamp, path }`. Controllers return `{ messageKey, data }`; the interceptor handles the envelope.
- **snake_case API** — all JSON request and response keys use `snake_case`. `@Expose({ name: 'camelKey' })` maps entity camelCase properties to the HTTP layer.
- **i18n Keys in DB** — skill names, categories, and industries are stored as i18n keys (e.g. `skill_react`). Translation happens at the API layer per request locale.

---

## Requirements

| Tool | Version |
|---|---|
| Node.js | 20.x LTS (`>=20.0.0`) |
| pnpm | 9.x (`>=9.0.0`) |
| PostgreSQL | 15+ |
| Redis | 7+ |

Install pnpm if you do not have it:

```bash
npm install -g pnpm
```

---

## Setup Guide

### 1. Install Node.js 20

Use [nvm](https://github.com/nvm-sh/nvm) (recommended):

```bash
nvm install 20
nvm use 20
node -v   # should print v20.x.x
```

### 2. Clone and install dependencies

```bash
git clone <repo-url>
cd api-gateway-service
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in all required values:

```env
NODE_ENV=development
PORT=3000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=marketplace

# JWT — generate strong random secrets in production
JWT_ACCESS_SECRET=change-me
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_SECRET=change-me-too
JWT_REFRESH_EXPIRATION=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=           # leave blank for no auth
REDIS_DB=0
REDIS_KEY_PREFIX=app:
REDIS_TLS_ENABLED=false

# Email (Resend — https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_PLOYOS_EMAIL=noreply@yourdomain.com
RESEND_LONA_EMAIL=noreply@yourdomain.com

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Platform frontend URLs
PLOYOS_URL=http://localhost:3000
LONA_URL=http://localhost:3001

# Payment processor — choose one: polar | stripe
PAYMENT_PROCESSOR=polar
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_TOP_UP_PRODUCT_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Google OAuth (optional — omit to disable SSO)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/sso/google/callback
```

### 4. Start infrastructure services

Using Docker:

```bash
# PostgreSQL
docker run -d \
  --name marketplace-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=marketplace-system-db-dev \
  -p 5432:5432 \
  postgres:15-alpine

# Redis
docker run -d \
  --name marketplace-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 5. Run database migrations

```bash
pnpm migration:run
```

This creates all tables, indexes, constraints, and DB triggers (including `trg_enforce_project_status` for project status transition validation).

### 6. Run the seed

Seeds the skills taxonomy (ESCO-sourced, ~800–2000 entries) along with their EN/TR translations. Safe to re-run — uses upsert semantics.

```bash
pnpm seed
```

Expected output:
```
Loaded: X categories, Y skills, Z industries
DataSource initialized
Skills: Y inserted, 0 updated, Y total
Distinct categories represented: X
Seed run complete
```

### 7. Start the application

**Development (hot reload):**

```bash
pnpm start:dev
```

**Production:**

```bash
pnpm build
pnpm start:prod
```

The API will be available at `http://localhost:3000/api/v1`.

Swagger UI: `http://localhost:3000/api/v1/docs`

---

## Other Useful Commands

| Command | Description |
|---|---|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm lint` | Run ESLint with auto-fix |
| `pnpm format` | Run Prettier |
| `pnpm test` | Run unit tests (Jest) |
| `pnpm test:cov` | Run tests with coverage report |
| `pnpm migration:generate --name=MigrationName` | Generate a new migration from entity changes |
| `pnpm migration:revert` | Revert the last applied migration |
