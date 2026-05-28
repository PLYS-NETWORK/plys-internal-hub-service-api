#!/usr/bin/env bash
# PM2 entry: ensure one compose service stays up; keeps PM2 alive with a monitor loop.
# gRPC/backend readiness is handled by deploy (docker-up) and in-container main.ts wait.
set -uo pipefail

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
MONITOR_INTERVAL_SEC="${COMPOSE_MONITOR_INTERVAL_SEC:-10}"

is_service_running() {
  "${DOCKER_BIN}" compose "${COMPOSE_ARGS[@]}" ps "$SERVICE" --status running -q 2>/dev/null | grep -q .
}

start_service() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) starting ${SERVICE} via docker compose"
  if "${DOCKER_BIN}" compose "${COMPOSE_ARGS[@]}" up -d --no-deps --remove-orphans "$SERVICE"; then
    return 0
  fi
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) docker compose up failed for ${SERVICE}" >&2
  return 1
}

if ! is_service_running; then
  start_service || true
fi

# Stream container logs in the background so PM2 log files stay current (no exec).
"${DOCKER_BIN}" compose "${COMPOSE_ARGS[@]}" logs -f --tail 50 "$SERVICE" 2>&1 &
LOGS_PID=$!
trap 'kill "$LOGS_PID" 2>/dev/null || true' EXIT INT TERM

while true; do
  if ! is_service_running; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${SERVICE} not running — restarting container"
    start_service || true
  fi
  sleep "${MONITOR_INTERVAL_SEC}"
done
