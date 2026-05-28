#!/bin/sh
set -eu

service="${SERVICE:-api-gateway}"

# Match module resolution used in verify-docker-runtime-modules.mjs
node_path="/app/node_modules:/app/packages/node_modules"
for dir in /app/apps/*/node_modules; do
  if [ -d "$dir" ]; then
    node_path="${node_path}:${dir}"
  fi
done
export NODE_PATH="$node_path"

# Self-heal missing dist proto copies (e.g. stale Docker layer cache).
if [ ! -f /app/packages/dist/proto/common/v1/http.proto ] && [ -d /app/packages/proto ]; then
  find /app/packages/proto -name '*.proto' | while IFS= read -r proto_file; do
    rel="${proto_file#/app/packages/proto/}"
    target_dir="/app/packages/dist/proto/$(dirname "$rel")"
    mkdir -p "$target_dir"
    cp "$proto_file" "/app/packages/dist/proto/$rel"
  done
fi

if [ "$service" = "migrate" ]; then
  node ./packages/node_modules/typeorm/cli.js migration:run -d packages/dist/database/data-source.js
  exec node packages/dist/database/seeds/seed-runner.js
fi

exec node "apps/${service}/dist/apps/${service}/src/main.js"
