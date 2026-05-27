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

if [ "$service" = "migrate" ]; then
  node ./packages/node_modules/typeorm/cli.js migration:run -d packages/dist/database/data-source.js
  exec node packages/dist/database/seeds/seed-runner.js
fi

exec node "apps/${service}/dist/apps/${service}/src/main.js"
