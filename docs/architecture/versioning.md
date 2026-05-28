# Versioning `@plys/libraries`

All shared libraries live under `packages/` as subfolders of a single workspace package: **`@plys/libraries`**.

---

## Library semver (Changesets)

Semver is defined once in [`packages/package.json`](../../packages/package.json):

```json
{
  "name": "@plys/libraries",
  "version": "0.2.0"
}
```

There is no per-module `package.json`. Bump the version only via [Changesets](https://github.com/changesets/changesets).

The fixed group in [`.changeset/config.json`](../../.changeset/config.json):

```json
"fixed": [["@plys/libraries"]]
```

When you run `pnpm changeset`, describe the change and select `@plys/libraries`. Running `pnpm version-packages` updates the single `version` field in `packages/package.json`.

### Adding a new shared module

1. Create a subfolder under `packages/`, e.g. `packages/my-module/`.
2. Add an export entry in `packages/package.json`:

   ```json
   "./my-module": "./my-module/index.ts",
   "./my-module/*": "./my-module/*"
   ```

3. Add a matching TypeScript path in [`tsconfig.base.json`](../../tsconfig.base.json) if needed.
4. Import from apps as `@plys/libraries/my-module`.

Do **not** add a nested `package.json` or duplicate `src/` wrapper per module.

### App dependencies

```json
"@plys/libraries": "workspace:*"
```

Import subpaths, for example:

- `@plys/libraries/proto`
- `@plys/libraries/database`
- `@plys/libraries/common-nest/modules/environments`
- `@plys/libraries/transaction-coordinator`

---

## HTTP API versioning (api-gateway)

Public REST uses **URI versioning** with default version **`1`**:

- Global prefix: `api` (`main.ts` → `setGlobalPrefix('api')`)
- Version: `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`
- Effective base path: **`/api/v1/`**

Swagger (non-production): `/api/v1/docs`.

Breaking HTTP contract changes should introduce **`v2`** (new folder + Nest version) rather than silently changing `v1` payloads documented in [api-specs/](../api-specs/).

---

## HTTP API v1 folder layout (gateway)

Source layout mirrors backend service boundaries under `apps/api-gateway/src/http/v1/`:

```
http/v1/
├── gateway/              # Edge health (no gRPC domain)
├── identity/             # → identity-service
├── business/             # → business-service (Ployos)
├── consultant/           # → consultant-service (Lonaos)
├── internal-admin/       # → internal-admin-service
├── internal-task-reviewer/  # → internal-task-reviewer-service
├── finance/              # → finance-service
├── notifications/        # → notifications-service (+ WebSocket gateway)
├── platform/             # → platform-service
├── ai-provider/          # → ai-provider-service
├── shared/               # gRPC proxy utilities (not a public route prefix)
├── _legacy_profiles/     # Deprecated — do not extend
└── _legacy_projects/     # Deprecated — do not extend
```

### Module pairing

Each `*HttpModule` imports:

1. Matching `*ClientsModule` from `apps/api-gateway/src/clients/v1/{service}/`
2. Controllers that call `createGrpcServiceProxy(ServiceToken, GRPC_CLIENT_TOKEN)`

### gRPC client layout

```
clients/v1/
├── identity/
├── business/
├── consultant/
├── internal-admin/
├── internal-task-reviewer/
├── finance/
├── notifications/
├── platform/
└── ai-provider/
```

Proto definitions for code generation live primarily in `packages/proto/{domain}/v1/`.

### Conventions for new endpoints

1. Add the controller under the correct `http/v1/{service}/controllers/` folder.
2. Register it in the service's `*-http.module.ts`.
3. Implement domain logic only in the target microservice; gateway stays transport-only.
4. Document the route in `docs/api-specs/{service-name}/{module}/`.
5. Use `{ messageKey, data }` success returns and `TranslatableException` with stable `errorCode` (see [../api/common-response.md](../api/common-response.md)).

---

## Related docs

| Document                                               | Topic                             |
| ------------------------------------------------------ | --------------------------------- |
| [system-architecture.md](./system-architecture.md)     | Service topology and request path |
| [../api/common-response.md](../api/common-response.md) | Response envelope                 |
