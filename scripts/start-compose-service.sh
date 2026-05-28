#!/usr/bin/env bash
# PM2 entry: start one compose service detached, then follow logs (keeps PM2 alive).
# api-gateway waits for backend gRPC ports before starting.
set -euo pipefail

SERVICE="${1:?service name required}"
DEPLOY_ENV="${2:?deploy env (dev|prod) required}"

COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.apps.yml -f "docker-compose.deploy.${DEPLOY_ENV}.yml")

if [[ "$SERVICE" == "api-gateway" ]]; then
  node scripts/wait-for-grpc-backends.mjs --env-file ".env.${DEPLOY_ENV}"
  sleep 3
  node scripts/wait-for-grpc-backends.mjs --env-file ".env.${DEPLOY_ENV}" --timeout-ms 60000
fi

docker compose "${COMPOSE_ARGS[@]}" up -d --no-deps --remove-orphans "$SERVICE"
exec docker compose "${COMPOSE_ARGS[@]}" logs -f "$SERVICE"
