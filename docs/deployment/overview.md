# Deployment Guide

## Overview

This monorepo deploys **10 NestJS services** (api-gateway + 9 gRPC microservices) via Docker on a VPS. **PM2 runs one process per service** — each process executes `docker compose up --no-deps <service>`. Images are built in CI and pushed to GHCR.

| Environment | Branch (default) | VPS path                             | App env file                                    | URL                     |
| ----------- | ---------------- | ------------------------------------ | ----------------------------------------------- | ----------------------- |
| Dev         | `develop`        | `/apps/internal-hub-be/dev/current`  | `env/.env.dev` (mounted as `.env.dev` on VPS)   | https://api-dev.lona.my |
| Prod        | `main`           | `/apps/internal-hub-be/prod/current` | `env/.env.prod` (mounted as `.env.prod` on VPS) | https://api.lona.my     |

For first-time VPS and GitHub setup, see [setup.md](./setup.md).

---

## Repository layout: `env/` and `docker/`

| Path                                             | Purpose                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `env/.env.example`                               | Documented non-secret defaults + gRPC port map                                   |
| `env/.env.dev`                                   | Committed dev VPS config (no secrets)                                            |
| `env/.env.prod`                                  | Committed prod VPS config                                                        |
| `env/.env.local`                                 | Local developer secrets (gitignored)                                             |
| `env/.env.docker`                                | Local Docker full-stack simulation (`DEPLOY_ENV=docker`, committed placeholders) |
| `env/secrets.list` / `env/secrets-optional.list` | CI secret injection manifests                                                    |
| `docker/docker-compose.yml`                      | Local Postgres + Redis                                                           |
| `docker/docker-compose.apps.yml`                 | All 10 runtime services + migrate                                                |
| `docker/docker-compose.deploy.dev.yml`           | Dev VPS overrides (GHCR images, `network_mode: host`)                            |
| `docker/docker-compose.deploy.prod.yml`          | Prod VPS overrides                                                               |
| `docker/docker-compose.local.yml`                | Local prod simulation (bridge network + `env/.env.docker`)                       |
| `docker/Dockerfile`                              | Multi-service image (`SERVICE` build arg)                                        |
| `deploy/ecosystem/`                              | PM2 compose monitors (`shared.js`, `dev.config.js`, `prod.config.js`)            |

`resolveEnvFilePath()` (`packages/config/env-file.config.ts`) loads `env/.env.{local|docker|dev|prod}` from the monorepo root based on `DEPLOY_ENV`.

---

## Environment naming

| Variable     | Values                              | Purpose              |
| ------------ | ----------------------------------- | -------------------- |
| `DEPLOY_ENV` | `local` / `docker` / `dev` / `prod` | Selects `env/.env.*` |
| `NODE_ENV`   | `development` / `production`        | Node runtime mode    |

| File               | Git | Used when                                                |
| ------------------ | --- | -------------------------------------------------------- |
| `env/.env.example` | yes | Documentation / Docker default                           |
| `env/.env.dev`     | yes | Dev VPS (`DEPLOY_ENV=dev`)                               |
| `env/.env.prod`    | yes | Prod VPS (`DEPLOY_ENV=prod`)                             |
| `env/.env.local`   | no  | Local dev secrets (`DEPLOY_ENV=local`, Nx serve)         |
| `env/.env.docker`  | yes | Local Docker full-stack simulation (`DEPLOY_ENV=docker`) |

### Frontend URLs and CORS (in `env/.env.dev` / `env/.env.prod`)

| Variable           | Dev example                                                       | Prod example                                          |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------- |
| `PLOYOS_URL`       | `https://dev.ployos.com`                                          | `https://ployos.com`                                  |
| `LONAOS_URL`       | `https://dev.lona.run`                                            | `https://lona.run`                                    |
| `INTERNAL_HUB_URL` | `https://dev.lona.my`                                             | `https://lona.my`                                     |
| `ALLOWED_ORIGINS`  | `https://dev.ployos.com,https://dev.lona.run,https://dev.lona.my` | `https://ployos.com,https://lona.run,https://lona.my` |

`ALLOWED_ORIGINS` lists **browser page origins** (the three clients above), not API hostnames.

| Variable               | Dev             | Prod    | Purpose                                               |
| ---------------------- | --------------- | ------- | ----------------------------------------------------- |
| `PORT`                 | `4001`          | `4000`  | api-gateway HTTP on VPS (`network_mode: host`)        |
| `CORS_ALLOW_LOCALHOST` | `true` (in dev) | ignored | Allows `http://localhost:*` without listing each port |

### gRPC ports (microservices)

On VPS with `network_mode: host`, services bind loopback ports from `env/.env.*`:

| Service                        | Env port var                       | Default |
| ------------------------------ | ---------------------------------- | ------- |
| identity-service               | `IDENTITY_GRPC_PORT`               | 5001    |
| business-service               | `BUSINESS_GRPC_PORT`               | 5002    |
| consultant-service             | `CONSULTANT_GRPC_PORT`             | 5003    |
| internal-admin-service         | `INTERNAL_ADMIN_GRPC_PORT`         | 5004    |
| internal-task-reviewer-service | `INTERNAL_TASK_REVIEWER_GRPC_PORT` | 5005    |
| finance-service                | `FINANCE_GRPC_PORT`                | 5006    |
| notifications-service          | `NOTIFICATIONS_GRPC_PORT`          | 5007    |
| platform-service               | `PLATFORM_GRPC_PORT`               | 5008    |
| ai-provider-service            | `AI_PROVIDER_GRPC_PORT`            | 5009    |

Optional override per service: `IDENTITY_GRPC_URL`, `BUSINESS_GRPC_URL`, … (used in Docker bridge networking locally).

---

## Compose image tags (VPS `current/.env`)

Not committed — CI writes `current/.env` on the VPS:

| Variable                                   | Service                                |
| ------------------------------------------ | -------------------------------------- |
| `IMAGE_REGISTRY`                           | GHCR prefix, e.g. `ghcr.io/owner/repo` |
| `IMAGE_TAG_API_GATEWAY`                    | api-gateway                            |
| `IMAGE_TAG_IDENTITY_SERVICE`               | identity-service                       |
| `IMAGE_TAG_BUSINESS_SERVICE`               | business-service                       |
| `IMAGE_TAG_CONSULTANT_SERVICE`             | consultant-service                     |
| `IMAGE_TAG_INTERNAL_ADMIN_SERVICE`         | internal-admin-service                 |
| `IMAGE_TAG_INTERNAL_TASK_REVIEWER_SERVICE` | internal-task-reviewer-service         |
| `IMAGE_TAG_FINANCE_SERVICE`                | finance-service                        |
| `IMAGE_TAG_NOTIFICATIONS_SERVICE`          | notifications-service                  |
| `IMAGE_TAG_PLATFORM_SERVICE`               | platform-service                       |
| `IMAGE_TAG_AI_PROVIDER_SERVICE`            | ai-provider-service                    |
| `IMAGE_TAG_MIGRATE`                        | migrate (one-shot)                     |

Full deploy sets all tags to the same SHA. Single-service deploy updates only one tag.

---

## Local development

**Infrastructure only** (postgres + redis):

```bash
pnpm docker:infra
# or: docker compose -f docker/docker-compose.yml up -d
```

**Full stack — production simulation in Docker** (builds images, migrates, starts all services):

```bash
pnpm docker:simulate
```

Step-by-step:

```bash
pnpm docker:build      # build all service images from docker/Dockerfile
pnpm docker:migrate    # one-shot migrate + seed container
pnpm docker:up         # start backends, wait for gRPC, then api-gateway
pnpm docker:ps         # status
pnpm docker:logs api-gateway
pnpm docker:down       # tear down
```

Gateway health: `http://localhost:3000/api/v1/gateway/health`

Uses `env/.env.docker` (Compose DNS for Postgres, Redis, and gRPC). Override secrets there for full feature testing (email, payments, S3).

**Nx serve** (traditional hot reload):

```bash
pnpm docker:infra
pnpm install
nx run-many -t serve --projects=identity-service,business-service,consultant-service,internal-admin-service,internal-task-reviewer-service,finance-service,notifications-service,platform-service,ai-provider-service,api-gateway
```

---

## CI/CD

### PR checks (merge gate)

Workflow: `.github/workflows/pr-checks.yml`

Configure branch protection on `main` and `develop`:

- Require status check: **All checks**
- Require branch up to date before merge

### Dev deploy

| Trigger                          | Behavior                                                 |
| -------------------------------- | -------------------------------------------------------- |
| Push to `develop`                | Full stack — build images, migrate, reload PM2           |
| Manual (Actions → Deploy to Dev) | Choose **service** (`all` or one) and **run_migrations** |

### Prod deploy

Manual only (Actions → Deploy to Production): type `deploy`, choose branch/service/migrations.

### Single-service deploy

1. Select the service (e.g. `api-gateway`)
2. Uncheck **Run migrations** unless `packages/database` changed
3. CI patches one `IMAGE_TAG_*`, pulls, `pm2 restart internal-hub-be-{env}-{service}`

Changes under `packages/` usually require **full deploy** (`service=all`).

### Render env locally (debug)

```bash
export DB_PASSWORD=... JWT_ACCESS_SECRET=...  # etc.
node scripts/render-deploy-env.mjs --deploy-env dev --output deploy/.env.dev
```

---

## Required GitHub secrets

Per environment (`dev` / `production`):

| Secret                                                   | Purpose                          |
| -------------------------------------------------------- | -------------------------------- |
| `DB_PASSWORD`                                            | PostgreSQL                       |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`               | Auth                             |
| `SSO_TOKEN_ENCRYPTION_KEY`                               | SSO                              |
| `PUBLIC_ENDPOINT_API_KEY`                                | BFF-gated public routes          |
| `GRPC_SERVICE_SECRET`                                    | Gateway ↔ microservice gRPC auth |
| `ALLOWED_ORIGINS`                                        | CORS frontend origins            |
| `CORS_ALLOW_LOCALHOST`                                   | Dev only                         |
| `RESEND_API_KEY`                                         | Email                            |
| `POLAR_*` / `STRIPE_*`                                   | Payments                         |
| `GOOGLE_CLIENT_SECRET`                                   | OAuth                            |
| `AWS_S3_*`                                               | File storage                     |
| `COPYLEAKS_API_KEY`                                      | Plagiarism                       |
| `REDIS_PASSWORD`                                         | Redis                            |
| `AI_KEYS_MASTER_KEY_v1` / `FE_BFF_SECRET_v1`             | AI key vault                     |
| `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` / `VPS_SSH_PORT` | SSH deploy                       |
| `GHCR_PULL_TOKEN`                                        | VPS docker pull                  |

Non-secret config lives in committed `env/.env.dev` / `env/.env.prod`.

---

## PM2 per-service model

Each runtime service has its own PM2 app (10 apps per environment):

| PM2 name (dev example)                               | Docker service                 |
| ---------------------------------------------------- | ------------------------------ |
| `internal-hub-be-dev-api-gateway`                    | api-gateway                    |
| `internal-hub-be-dev-identity-service`               | identity-service               |
| `internal-hub-be-dev-business-service`               | business-service               |
| `internal-hub-be-dev-consultant-service`             | consultant-service             |
| `internal-hub-be-dev-internal-admin-service`         | internal-admin-service         |
| `internal-hub-be-dev-internal-task-reviewer-service` | internal-task-reviewer-service |
| `internal-hub-be-dev-finance-service`                | finance-service                |
| `internal-hub-be-dev-notifications-service`          | notifications-service          |
| `internal-hub-be-dev-platform-service`               | platform-service               |
| `internal-hub-be-dev-ai-provider-service`            | ai-provider-service            |

Prod uses `internal-hub-be-prod-*` names.

Logs:

```
/apps/internal-hub-be/dev/logs/api-gateway-out.log
/apps/internal-hub-be/dev/logs/business-service-error.log
...
```

PM2 settings (`deploy/ecosystem/shared.js`): `log_date_format`, `max_memory_restart: 300M`, `min_uptime`, `restart_delay`, separate stdout/stderr files.

Backends start before api-gateway so gRPC ports are listening when the gateway bootstraps.

### VPS operations

```bash
pm2 status
pm2 logs internal-hub-be-dev-api-gateway
cd /apps/internal-hub-be/dev/current
pm2 startOrReload ecosystem/dev.config.js
pm2 save
pm2 restart internal-hub-be-dev-business-service
```

### Manual migration

```bash
cd /apps/internal-hub-be/dev/current
docker compose -f docker/docker-compose.yml -f docker/docker-compose.apps.yml -f docker/docker-compose.deploy.dev.yml \
  --profile migrate run --rm migrate
```

---

## Rollback

**Full stack** — set all `IMAGE_TAG_*` in `current/.env` to a previous SHA, pull, reload PM2.

**Single service** — patch one tag and restart that PM2 app:

```bash
node scripts/patch-image-tag.mjs --file .env --service business-service --tag main-abc1234 --registry ghcr.io/owner/repo
docker compose -f docker/docker-compose.yml -f docker/docker-compose.apps.yml -f docker/docker-compose.deploy.dev.yml pull business-service
pm2 restart internal-hub-be-dev-business-service
```

---

## Docker images

Built from `docker/Dockerfile` with `SERVICE` arg:

`api-gateway`, `identity-service`, `business-service`, `consultant-service`, `internal-admin-service`, `internal-task-reviewer-service`, `finance-service`, `notifications-service`, `platform-service`, `ai-provider-service`, `migrate`

Tags: `ghcr.io/<owner>/<repo>/<service>:<branch>-<sha>`

---

## Related docs

| Document                                                                         | Topic                   |
| -------------------------------------------------------------------------------- | ----------------------- |
| [setup.md](./setup.md)                                                           | First-time VPS + GitHub |
| [../architecture/system-architecture.md](../architecture/system-architecture.md) | Service topology        |
