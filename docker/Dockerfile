# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN npm install -g pnpm@10.32.1
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/package.json packages/
COPY apps/api-gateway/package.json apps/api-gateway/
COPY apps/identity-service/package.json apps/identity-service/
COPY apps/business-service/package.json apps/business-service/
COPY apps/consultant-service/package.json apps/consultant-service/
COPY apps/internal-admin-service/package.json apps/internal-admin-service/
COPY apps/internal-task-reviewer-service/package.json apps/internal-task-reviewer-service/
COPY apps/finance-service/package.json apps/finance-service/
COPY apps/notifications-service/package.json apps/notifications-service/
COPY apps/platform-service/package.json apps/platform-service/
COPY apps/ai-provider-service/package.json apps/ai-provider-service/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm exec nx run-many -t build \
  --projects=libraries,api-gateway,identity-service,business-service,consultant-service,internal-admin-service,internal-task-reviewer-service,finance-service,notifications-service,platform-service,ai-provider-service
RUN node scripts/copy-proto-to-dist.mjs
RUN node scripts/patch-packages-exports-for-runtime.mjs
RUN node scripts/verify-docker-runtime-modules.mjs

FROM base AS runtime
ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules:/app/packages/node_modules

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ARG SERVICE=api-gateway
ENV SERVICE=${SERVICE}

ENTRYPOINT ["docker-entrypoint.sh"]
