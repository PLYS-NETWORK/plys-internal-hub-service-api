# Documentation

## Deployment

| Doc                                                | Description                                  |
| -------------------------------------------------- | -------------------------------------------- |
| [deployment/overview.md](./deployment/overview.md) | CI/CD, Docker, PM2 per-service ops, rollback |
| [deployment/setup.md](./deployment/setup.md)       | First-time VPS + GitHub setup                |

## Architecture

| Doc                                                                              | Description                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [architecture/system-architecture.md](./architecture/system-architecture.md)     | Services, gRPC bridge, security, data layer, packages |
| [architecture/domain-ownership.md](./architecture/domain-ownership.md)           | Table ownership and bounded contexts                  |
| [architecture/transaction-inventory.md](./architecture/transaction-inventory.md) | Composite SQL transactions during monorepo migration  |
| [architecture/versioning.md](./architecture/versioning.md)                       | `@plys/libraries` semver via Changesets               |

## Integration

| Doc                                                            | Description                        |
| -------------------------------------------------------------- | ---------------------------------- |
| [integration/ai-chat-flows.md](./integration/ai-chat-flows.md) | AI chat frontend integration guide |

## API specs

OpenAPI-style endpoint specs grouped by platform and domain:

- [api-specs/](./api-specs/) — `admin/`, `business/`, `consultant/`, `public/`, `shared/`
