# Deployment Guide

## Overview

This monorepo deploys **6 NestJS services** via Docker on a VPS. **PM2 runs one process per service** — each process executes `docker compose up --no-deps <service>`. Images are built in CI and pushed to GHCR.

| Environment | Branch (default) | VPS path                             | App env file | URL                     |
| ----------- | ---------------- | ------------------------------------ | ------------ | ----------------------- |
| Dev         | `develop`        | `/apps/internal-hub-be/dev/current`  | `.env.dev`   | https://api-dev.lona.my |
| Prod        | `main`           | `/apps/internal-hub-be/prod/current` | `.env.prod`  | https://api.lona.my     |

For first-time VPS and GitHub setup, see [setup.md](./setup.md).

## Environment naming

| Variable     | Values                       | Purpose                                                         |
| ------------ | ---------------------------- | --------------------------------------------------------------- |
| `DEPLOY_ENV` | `local` / `dev` / `prod`     | Selects app config file (`.env.local`, `.env.dev`, `.env.prod`) |
| `NODE_ENV`   | `development` / `production` | Node runtime mode                                               |

| File           | Git | Used when                    |
| -------------- | --- | ---------------------------- |
| `.env.example` | yes | Documentation                |
| `.env.dev`     | yes | Dev VPS (`DEPLOY_ENV=dev`)   |
| `.env.prod`    | yes | Prod VPS (`DEPLOY_ENV=prod`) |
| `.env.local`   | no  | Local dev secrets            |

Compose image tags live in **`current/.env`** on the VPS (not committed):

| Variable                     | Service                                |
| ---------------------------- | -------------------------------------- |
| `IMAGE_REGISTRY`             | GHCR prefix, e.g. `ghcr.io/owner/repo` |
| `IMAGE_TAG_API_GATEWAY`      | api-gateway                            |
| `IMAGE_TAG_IDENTITY_SERVICE` | identity-service                       |
| `IMAGE_TAG_PROFILES_SERVICE` | profiles-service                       |
| `IMAGE_TAG_PROJECTS_SERVICE` | projects-service                       |
| `IMAGE_TAG_FINANCE_SERVICE`  | finance-service                        |
| `IMAGE_TAG_PLATFORM_SERVICE` | platform-service                       |
| `IMAGE_TAG_MIGRATE`          | migrate (one-shot)                     |

Full deploy sets all tags to the same SHA. Single-service deploy updates only one tag.

## Local development

**Infrastructure only** (postgres + redis):

```bash
docker compose up -d
```

**Full stack in Docker** (requires `.env.local`):

```bash
docker compose -f docker-compose.yml -f docker-compose.apps.yml up --build
```

**Nx serve** (traditional):

```bash
docker compose up -d
pnpm install
nx run-many -t serve --projects=identity-service,profiles-service,projects-service,finance-service,platform-service,api-gateway
```

## CI/CD

### PR checks (merge gate)

Workflow: `.github/workflows/pr-checks.yml`

Configure branch protection on `main` and `develop`:

- Require status check: **All checks**
- Require branch up to date before merge

### Dev deploy

| Trigger                          | Behavior                                                         |
| -------------------------------- | ---------------------------------------------------------------- |
| Push to `develop`                | Full stack — build all images, migrate, reload all PM2 apps      |
| Manual (Actions → Deploy to Dev) | Choose **service** (`all` or one service) and **run_migrations** |

### Prod deploy

Manual only (Actions → Deploy to Production):

- Type `deploy` to confirm
- Choose branch (default `main`), service, and whether to run migrations

### Single-service deploy

Use manual workflow dispatch when only one service changed:

1. Select the service (e.g. `api-gateway`)
2. Uncheck **Run migrations** unless `packages/database` changed
3. CI builds/pushes only that image, patches one `IMAGE_TAG_*` on VPS, pulls that image, and `pm2 restart internal-hub-be-{env}-{service}`

Changes under `packages/` shared libraries usually require a **full deploy** (`service=all`).

### Render env locally (debug)

```bash
export DB_PASSWORD=... JWT_ACCESS_SECRET=...  # etc.
node scripts/render-deploy-env.mjs --deploy-env dev --output deploy/.env.dev
```

## Required GitHub secrets

Per environment (`dev` / `production`):

| Secret                                                   | Purpose                                    |
| -------------------------------------------------------- | ------------------------------------------ |
| `DB_PASSWORD`                                            | PostgreSQL                                 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`               | Auth                                       |
| `SSO_TOKEN_ENCRYPTION_KEY`                               | SSO                                        |
| `PUBLIC_ENDPOINT_API_KEY`                                | Explore API                                |
| `RESEND_API_KEY`                                         | Email                                      |
| `POLAR_*` / `STRIPE_*`                                   | Payments                                   |
| `GOOGLE_CLIENT_SECRET`                                   | OAuth                                      |
| `AWS_S3_*`                                               | File storage                               |
| `COPYLEAKS_API_KEY`                                      | Plagiarism                                 |
| `REDIS_PASSWORD`                                         | Redis                                      |
| `AI_KEYS_MASTER_KEY_v1` / `FE_BFF_SECRET_v1`             | AI key vault                               |
| `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` / `VPS_SSH_PORT` | SSH deploy                                 |
| `GHCR_PULL_TOKEN`                                        | VPS docker pull (PAT with `read:packages`) |

Non-secret config lives in committed `.env.dev` / `.env.prod`.

## PM2 per-service model

Each runtime service has its own PM2 app:

| PM2 name (dev)                         | Docker service   |
| -------------------------------------- | ---------------- |
| `internal-hub-be-dev-api-gateway`      | api-gateway      |
| `internal-hub-be-dev-identity-service` | identity-service |
| `internal-hub-be-dev-profiles-service` | profiles-service |
| `internal-hub-be-dev-projects-service` | projects-service |
| `internal-hub-be-dev-finance-service`  | finance-service  |
| `internal-hub-be-dev-platform-service` | platform-service |

Prod uses `internal-hub-be-prod-*` names.

Log files (per service):

```
/apps/internal-hub-be/dev/logs/api-gateway-out.log
/apps/internal-hub-be/dev/logs/api-gateway-error.log
...
```

PM2 settings (from `ecosystem.shared.js`): `log_date_format`, `max_memory_restart: 300M`, `min_uptime`, `restart_delay`, separate stdout/stderr files.

### VPS operations

```bash
# Status
pm2 status

# Logs for one service
pm2 logs internal-hub-be-dev-api-gateway

# Reload all apps (after full deploy)
cd /apps/internal-hub-be/dev/current
pm2 startOrReload ecosystem.dev.config.js
pm2 save

# Restart one service manually
pm2 restart internal-hub-be-dev-api-gateway
```

### One-time migration from monolithic PM2

If the VPS still runs the old single app `internal-hub-be-dev`:

```bash
pm2 delete internal-hub-be-dev          # or internal-hub-be-prod
mkdir -p /apps/internal-hub-be/dev/logs
cd /apps/internal-hub-be/dev/current
pm2 start ecosystem.dev.config.js
pm2 save
```

### Manual migration

```bash
cd /apps/internal-hub-be/dev/current
docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.deploy.dev.yml \
  --profile migrate run --rm migrate
```

## Rollback

**Full stack** — set all tags in `current/.env` to a previous SHA, then:

```bash
node scripts/patch-image-tag.mjs --file .env --service all --tag main-abc1234 --registry ghcr.io/owner/repo
docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.deploy.dev.yml pull
pm2 startOrReload ecosystem.dev.config.js
```

**Single service** — patch one tag and restart that PM2 app:

```bash
node scripts/patch-image-tag.mjs --file .env --service api-gateway --tag main-abc1234 --registry ghcr.io/owner/repo
docker compose -f docker-compose.yml -f docker-compose.apps.yml -f docker-compose.deploy.dev.yml pull api-gateway
pm2 restart internal-hub-be-dev-api-gateway
```

## Docker images

Built from root `Dockerfile` with `SERVICE` arg:

- `api-gateway`, `identity-service`, `profiles-service`, `projects-service`, `finance-service`, `platform-service`, `migrate`

Tags: `ghcr.io/<owner>/<repo>/<service>:<branch>-<sha>`
