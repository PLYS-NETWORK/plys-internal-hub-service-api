#!/usr/bin/env bash
# PM2 entry: start one compose service detached, then keep it running (keeps PM2 alive).
# api-gateway waits for backend gRPC ports before starting.
set -euo pipefail

SERVICE="${1:?service name required}"
DEPLOY_ENV="${2:?deploy env (dev|prod) required}"

COMPOSE_ARGS=(-f docker-compose.yml -f docker-compose.apps.yml -f "docker-compose.deploy.${DEPLOY_ENV}.yml")

resolve_docker() {
  if [[ -n "${DOCKER:-}" && -x "${DOCKER}" ]]; then
    echo "${DOCKER}"
    return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    command -v docker
    return 0
  fi
  echo "ERROR: docker not found or not executable (DOCKER=${DOCKER:-unset})" >&2
  exit 1
}

DOCKER_BIN="$(resolve_docker)"

if [[ "$SERVICE" == "api-gateway" ]]; then
  node scripts/wait-for-grpc-backends.mjs --env-file ".env.${DEPLOY_ENV}"
  sleep 3
  node scripts/wait-for-grpc-backends.mjs --env-file ".env.${DEPLOY_ENV}" --timeout-ms 60000
fi

"${DOCKER_BIN}" compose "${COMPOSE_ARGS[@]}" up -d --no-deps --remove-orphans "$SERVICE"

MONITOR_INTERVAL_SEC="${COMPOSE_MONITOR_INTERVAL_SEC:-10}"

while true; do
  if ! "${DOCKER_BIN}" compose "${COMPOSE_ARGS[@]}" ps "$SERVICE" --status running -q 2>/dev/null | grep -q .; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${SERVICE} not running — restarting container"
    "${DOCKER_BIN}" compose "${COMPOSE_ARGS[@]}" up -d --no-deps --remove-orphans "$SERVICE" || true
  fi
  sleep "${MONITOR_INTERVAL_SEC}"
done
