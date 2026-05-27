# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/package.json packages/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/identity-service/package.json apps/identity-service/
COPY apps/profiles-service/package.json apps/profiles-service/
COPY apps/projects-service/package.json apps/projects-service/
COPY apps/finance-service/package.json apps/finance-service/
COPY apps/platform-service/package.json apps/platform-service/
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm exec nx run-many -t build \
  --projects=libraries,api-gateway,identity-service,profiles-service,projects-service,finance-service,platform-service

# ─── Runtime base ─────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps

ARG SERVICE=api-gateway
ENV SERVICE=${SERVICE}

# migrate runs TypeORM migrations + seeds then exits
CMD if [ "$SERVICE" = "migrate" ]; then \
      node ./packages/node_modules/typeorm/cli.js migration:run -d packages/dist/database/data-source.js && \
      node packages/dist/database/seeds/seed-runner.js; \
    else \
      node apps/${SERVICE}/dist/main.js; \
    fi
