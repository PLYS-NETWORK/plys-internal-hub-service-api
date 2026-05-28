# Deployment Setup — VPS to GitHub

Step-by-step guide to prepare a VPS, configure GitHub, and run the first deploy for the Plys internal hub backend.

## Prerequisites

| Item        | Requirement                                                          |
| ----------- | -------------------------------------------------------------------- |
| VPS         | Ubuntu 22.04+ (or similar), 4 GB+ RAM recommended for 6 services     |
| Domain      | DNS A record pointing to VPS (e.g. `api-dev.lona.my`, `api.lona.my`) |
| GitHub repo | Admin access to configure secrets and environments                   |
| External DB | PostgreSQL and Redis reachable from VPS (not in compose on VPS)      |

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

The API gateway listens on the host loopback port from `PORT` in `.env.dev` / `.env.prod` (dev **4001**, prod **4000**); expose it via reverse proxy (nginx/Caddy) on 443.

### 1.4 Reverse proxy (outline)

Point `https://api-dev.lona.my` → `http://127.0.0.1:4001` and `https://api.lona.my` → `http://127.0.0.1:4000`. Use TLS termination at the proxy (Let's Encrypt).

---

## 2. Configure GitHub

### 2.1 Environments

Create two GitHub environments under **Settings → Environments**:

| Name         | Purpose                                   |
| ------------ | ----------------------------------------- |
| `dev`        | Dev VPS deploy                            |
| `production` | Prod VPS deploy (optional approval rules) |

### 2.2 Repository secrets

Add these secrets to **each environment** (values differ per env):

| Secret                                              | How to obtain                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `DB_PASSWORD`                                       | PostgreSQL password                                                     |
| `JWT_ACCESS_SECRET`                                 | `jwt_hmac_sha256` — `openssl rand -base64 48`                           |
| `JWT_REFRESH_SECRET`                                | `jwt_hmac_sha256` — `openssl rand -base64 48` (must differ from access) |
| `PUBLIC_ENDPOINT_API_KEY`                           | `openssl rand -base64 32`                                               |
| `GRPC_SERVICE_SECRET`                               | `jwt_hmac_sha256` — `openssl rand -base64 48` (shared across services)  |
| `SSO_TOKEN_ENCRYPTION_KEY`                          | Optional until SSO is enabled — `openssl rand -base64 32`               |
| `RESEND_API_KEY`                                    | Resend dashboard                                                        |
| `POLAR_ACCESS_TOKEN` / `POLAR_WEBHOOK_SECRET`       | Polar dashboard                                                         |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`       | Stripe dashboard                                                        |
| `GOOGLE_CLIENT_SECRET`                              | Google Cloud Console                                                    |
| `AWS_S3_ACCESS_KEY_ID` / `AWS_S3_SECRET_ACCESS_KEY` | AWS IAM                                                                 |
| `COPYLEAKS_API_KEY`                                 | Copyleaks                                                               |
| `REDIS_PASSWORD`                                    | Redis provider                                                          |
| `AI_KEYS_MASTER_KEY_v1`                             | `aes_256_gcm_key_base64` — `openssl rand -base64 32`                    |
| `FE_BFF_SECRET_v1`                                  | `aes_256_gcm_key_base64` — `openssl rand -base64 32`                    |
| `VPS_HOST`                                          | VPS IP or hostname                                                      |
| `VPS_USER`                                          | SSH user                                                                |
| `VPS_SSH_KEY`                                       | Private key (PEM) for deploy user                                       |
| `VPS_SSH_PORT`                                      | Usually `22`                                                            |
| `GHCR_PULL_TOKEN`                                   | GitHub PAT with `read:packages` scope                                   |

Non-secret values (URLs, feature flags, DB host/port) live in committed [`.env.dev`](../../.env.dev) / [`.env.prod`](../../.env.prod).

### 2.3 GHCR pull token on VPS

Create a GitHub Personal Access Token (classic) with `read:packages`. Store it as `GHCR_PULL_TOKEN` in GitHub secrets. CI logs the VPS into GHCR during each deploy.

### 2.4 Branch protection

On `main` and `develop`:

- Require PR before merge
- Require status check: **All checks** (from `pr-checks.yml`)

---

## 3. Configure the project

### 3.1 App environment files

Edit committed templates for each environment:

- [`.env.dev`](../../.env.dev) — DB host, Redis host, URLs, non-secrets for dev VPS
- [`.env.prod`](../../.env.prod) — same for production

Ensure `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `REDIS_HOST`, etc. point to your external services.

### 3.2 Compose image registry

CI writes `current/.env` on the VPS with:

```env
IMAGE_REGISTRY=ghcr.io/<github-owner>/<repo-name>
IMAGE_TAG_API_GATEWAY=develop-abc123
...
```

No manual edit needed after the first successful deploy.

---

## 4. First deploy

### 4.1 Dev (recommended first)

1. Merge code to `develop` (or run **Actions → Deploy to Dev** manually)
2. Select **service: all**, **run migrations: true**
3. Wait for workflow to complete (build → upload bundle → pull → migrate → PM2)

### 4.2 Verify on VPS

```bash
pm2 status
# Expect 6 apps: internal-hub-be-dev-api-gateway, ...-identity-service, etc.

curl -s http://127.0.0.1:4001/api/v1/gateway/health   # dev VPS (PORT in .env.dev)
curl -s https://api-dev.lona.my/v1/health             # public URL — requires nginx → :4001
docker ps
```

### 4.3 Production

1. **Actions → Deploy to Production**
2. Type `deploy` to confirm
3. Branch: `main`, service: `all`, run migrations: true

---

## 5. Day-to-day operations

### Deploy one service only

**Actions → Deploy to Dev** (or Production):

| Field          | Value                            |
| -------------- | -------------------------------- |
| service        | e.g. `api-gateway`               |
| run_migrations | Uncheck unless DB schema changed |

Only that image is built, pulled, and restarted via PM2.

### Deploy full stack

Push to `develop` (auto) or manual dispatch with **service: all**.

### View logs

```bash
pm2 logs internal-hub-be-dev-api-gateway --lines 100
tail -f /apps/internal-hub-be/dev/logs/api-gateway-error.log
```

### Rollback one service

See [overview.md](./overview.md#rollback).

---

## 6. Troubleshooting

| Symptom                            | Check                                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pull access denied`               | `GHCR_PULL_TOKEN` valid; `docker login ghcr.io` on VPS                                                                                                                            |
| PM2 app errored                    | `pm2 logs <name>`; verify `.env` has all `IMAGE_TAG_*` keys                                                                                                                       |
| Health check fails                 | `curl http://127.0.0.1:4001/api/v1/gateway/health` on VPS; `pm2 logs internal-hub-be-dev-api-gateway`; nginx must proxy to dev `:4001` / prod `:4000` (502 = wrong upstream port) |
| Migration failed                   | Run migrate manually; check `DB_*` in `.env.dev` on VPS                                                                                                                           |
| Single deploy broke other services | Other services keep old tags — only target PM2 app restarts                                                                                                                       |

---

## Related docs

- [overview.md](./overview.md) — CI/CD reference, PM2 model, rollback
- [README.md](../../README.md) — Local development setup
