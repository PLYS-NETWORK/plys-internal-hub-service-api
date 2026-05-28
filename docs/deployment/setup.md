# Deployment Setup — VPS to GitHub

Step-by-step guide to prepare a VPS, configure GitHub, and run the first deploy for the Plys internal hub backend (**10 runtime services**).

---

## Prerequisites

| Item        | Requirement                                                           |
| ----------- | --------------------------------------------------------------------- |
| VPS         | Ubuntu 22.04+ (or similar), **8 GB+ RAM recommended** for 10 services |
| Domain      | DNS A record → VPS (`api-dev.lona.my`, `api.lona.my`)                 |
| GitHub repo | Admin access for secrets and environments                             |
| External DB | PostgreSQL and Redis reachable from VPS (not in compose on VPS)       |

---

## 1. Prepare the VPS

### 1.1 Install system packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg ufw

# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
# Log out and back in for group membership

# Node.js 22 (for patch-image-tag.mjs on deploy)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2
pm2 startup systemd   # follow printed instructions
```

### 1.2 Create directory layout

```bash
sudo mkdir -p /apps/internal-hub-be/dev/current /apps/internal-hub-be/dev/logs
sudo mkdir -p /apps/internal-hub-be/prod/current /apps/internal-hub-be/prod/logs
sudo chown -R "$USER:$USER" /apps/internal-hub-be
```

### 1.3 Firewall (example)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

api-gateway listens on host `PORT` from env (**4001** dev, **4000** prod). gRPC services use **5001–5009** on loopback only — do not expose those ports publicly.

### 1.4 Reverse proxy (outline)

| Public URL                | Upstream                |
| ------------------------- | ----------------------- |
| `https://api-dev.lona.my` | `http://127.0.0.1:4001` |
| `https://api.lona.my`     | `http://127.0.0.1:4000` |

Use TLS termination at the proxy (Let's Encrypt).

---

## 2. Configure GitHub

### 2.1 Environments

| Name         | Purpose                                   |
| ------------ | ----------------------------------------- |
| `dev`        | Dev VPS deploy                            |
| `production` | Prod VPS deploy (optional approval rules) |

### 2.2 Repository secrets

Add to **each environment** (values differ per env):

| Secret                                                   | How to obtain                                       |
| -------------------------------------------------------- | --------------------------------------------------- |
| `DB_PASSWORD`                                            | PostgreSQL password                                 |
| `JWT_ACCESS_SECRET`                                      | `openssl rand -base64 48`                           |
| `JWT_REFRESH_SECRET`                                     | `openssl rand -base64 48` (must differ from access) |
| `PUBLIC_ENDPOINT_API_KEY`                                | `openssl rand -base64 32`                           |
| `GRPC_SERVICE_SECRET`                                    | `openssl rand -base64 48` (shared across services)  |
| `SSO_TOKEN_ENCRYPTION_KEY`                               | Optional until SSO — `openssl rand -base64 32`      |
| `RESEND_API_KEY`                                         | Resend dashboard                                    |
| `POLAR_ACCESS_TOKEN` / `POLAR_WEBHOOK_SECRET`            | Polar dashboard                                     |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`            | Stripe dashboard                                    |
| `GOOGLE_CLIENT_SECRET`                                   | Google Cloud Console                                |
| `AWS_S3_ACCESS_KEY_ID` / `AWS_S3_SECRET_ACCESS_KEY`      | AWS IAM                                             |
| `COPYLEAKS_API_KEY`                                      | Copyleaks                                           |
| `REDIS_PASSWORD`                                         | Redis provider                                      |
| `AI_KEYS_MASTER_KEY_v1`                                  | `openssl rand -base64 32`                           |
| `FE_BFF_SECRET_v1`                                       | `openssl rand -base64 32`                           |
| `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` / `VPS_SSH_PORT` | SSH deploy                                          |
| `GHCR_PULL_TOKEN`                                        | GitHub PAT with `read:packages`                     |

Non-secret values live in committed [`env/.env.dev`](../../env/.env.dev) / [`env/.env.prod`](../../env/.env.prod).

### 2.3 GHCR pull token on VPS

Store `GHCR_PULL_TOKEN` in GitHub secrets. CI runs `docker login ghcr.io` on the VPS during deploy.

### 2.4 Branch protection

On `main` and `develop`:

- Require PR before merge
- Require status check: **All checks** (`pr-checks.yml`)

---

## 3. Configure the project

### 3.1 App environment files

Edit:

- [`env/.env.dev`](../../env/.env.dev) — DB/Redis hosts, URLs, gRPC ports **5001–5009**
- [`env/.env.prod`](../../env/.env.prod) — production equivalents

Ensure `DB_HOST`, `REDIS_HOST`, and `GRPC_HOST=127.0.0.1` match your VPS layout.

### 3.2 Compose image registry

After first successful deploy, `current/.env` contains:

```env
IMAGE_REGISTRY=ghcr.io/<github-owner>/<repo-name>
IMAGE_TAG_API_GATEWAY=develop-abc123
IMAGE_TAG_IDENTITY_SERVICE=develop-abc123
IMAGE_TAG_BUSINESS_SERVICE=develop-abc123
IMAGE_TAG_CONSULTANT_SERVICE=develop-abc123
IMAGE_TAG_INTERNAL_ADMIN_SERVICE=develop-abc123
IMAGE_TAG_INTERNAL_TASK_REVIEWER_SERVICE=develop-abc123
IMAGE_TAG_FINANCE_SERVICE=develop-abc123
IMAGE_TAG_NOTIFICATIONS_SERVICE=develop-abc123
IMAGE_TAG_PLATFORM_SERVICE=develop-abc123
IMAGE_TAG_AI_PROVIDER_SERVICE=develop-abc123
IMAGE_TAG_MIGRATE=develop-abc123
```

---

## 4. First deploy

### 4.1 Dev (recommended first)

1. Merge to `develop` or run **Actions → Deploy to Dev**
2. **service: all**, **run migrations: true**
3. Wait for build → upload → pull → migrate → PM2

### 4.2 Verify on VPS

```bash
pm2 status
# Expect 10 apps: internal-hub-be-dev-api-gateway, ...-identity-service,
# ...-business-service, ...-consultant-service, ...-internal-admin-service,
# ...-internal-task-reviewer-service, ...-finance-service, ...-notifications-service,
# ...-platform-service, ...-ai-provider-service

curl -s http://127.0.0.1:4001/api/v1/gateway/health
curl -s https://api-dev.lona.my/api/v1/gateway/health
docker ps
```

### 4.3 Production

1. **Actions → Deploy to Production**
2. Type `deploy`, branch `main`, service `all`, migrations true

---

## 5. Day-to-day operations

### Deploy one service

| Field          | Value                                      |
| -------------- | ------------------------------------------ |
| service        | e.g. `business-service`                    |
| run_migrations | Uncheck unless `packages/database` changed |

### Deploy full stack

Push to `develop` or manual dispatch with **service: all**.

### View logs

```bash
pm2 logs internal-hub-be-dev-business-service --lines 100
tail -f /apps/internal-hub-be/dev/logs/business-service-error.log
```

### Rollback

See [overview.md](./overview.md#rollback).

---

## 6. Troubleshooting

| Symptom                    | Check                                                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| `pull access denied`       | `GHCR_PULL_TOKEN`; `docker login ghcr.io` on VPS                           |
| PM2 app errored            | `pm2 logs <name>`; all `IMAGE_TAG_*` keys in `current/.env`                |
| Health check fails         | `curl http://127.0.0.1:4001/api/v1/gateway/health`; nginx → correct `PORT` |
| Gateway starts before gRPC | Restart api-gateway PM2 app after backends are up                          |
| gRPC connection refused    | `ss -lntp \| grep 500` — ports 5001–5009 on 127.0.0.1                      |
| Migration failed           | Manual migrate; `DB_*` in mounted `.env.dev`                               |
| Single deploy broke others | Only target PM2 app restarts; other tags unchanged                         |

---

## Related docs

| Document                                                                         | Topic                              |
| -------------------------------------------------------------------------------- | ---------------------------------- |
| [overview.md](./overview.md)                                                     | CI/CD, PM2, image tags, gRPC ports |
| [../architecture/system-architecture.md](../architecture/system-architecture.md) | Service topology                   |
| [../../README.md](../../README.md)                                               | Local development                  |
