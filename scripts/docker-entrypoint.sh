#!/bin/sh
set -eu

service="${SERVICE:-api-gateway}"

if [ "$service" = "migrate" ]; then
  node ./packages/node_modules/typeorm/cli.js migration:run -d packages/dist/database/data-source.js
  exec node packages/dist/database/seeds/seed-runner.js
fi

exec node "apps/${service}/dist/apps/${service}/src/main.js"
