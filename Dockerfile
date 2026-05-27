# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
# corepack prepare pnpm@10 fails on Alpine (wrong binary arch); pin via npm instead.
RUN npm install -g pnpm@10.32.1
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
RUN node scripts/patch-packages-exports-for-runtime.mjs

# ─── Runtime base ─────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ARG SERVICE=api-gateway
ENV SERVICE=${SERVICE}

ENTRYPOINT ["docker-entrypoint.sh"]
