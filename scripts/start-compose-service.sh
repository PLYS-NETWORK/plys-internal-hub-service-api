#!/usr/bin/env bash
# PM2 entry: start one compose service; api-gateway waits for backend gRPC ports first.
set -euo pipefail

SERVICE="${1:?service name required}"
DEPLOY_ENV="${2:?deploy env (dev|prod) required}"

COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.apps.yml -f "docker-compose.deploy.${DEPLOY_ENV}.yml")

if [[ "$SERVICE" == "api-gateway" ]]; then
  node scripts/wait-for-grpc-backends.mjs --env-file ".env.${DEPLOY_ENV}"
fi

exec docker compose "${COMPOSE_ARGS[@]}" up --no-deps --remove-orphans "$SERVICE"
