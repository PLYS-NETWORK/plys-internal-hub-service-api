# Idempotent Replay (`Idempotency-Key`)

> **Source:** [src/common/interceptors/idempotency.interceptor.ts](../../../src/common/interceptors/idempotency.interceptor.ts)
> **Decorator:** [`@IdempotencyKey()`](../../../src/common/decorators/idempotency-key.decorator.ts) — endpoints that opt in are marked in their per-controller spec.

Idempotent replay is **opt-in by the client** (the BE never enforces). Endpoints decorated with `@IdempotencyKey()` accept a request header that the BE uses to cache `(status, body)` and replay it verbatim on retry.

## Wire contract

- **Header:** `Idempotency-Key: <string, 1–80 chars>`. Suggested value: a UUID v4. Other shapes (ULID, content hash) work as long as they're stable for retries of the same logical request.
- **Skip the header → endpoint behaves normally.** No replay, no row stored. Safe for clients that don't care about retry safety (browsers refreshing a page that already saw the response).
- **TTL:** rows live 6 hours; the `expire-idempotency-keys` cron (every 15 min) cleans up expired ones.

## Replay rules

| Scenario                                           | BE behaviour                                                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First request with a given `(key, user, endpoint)` | Runs the handler, stores `(request_hash, response_status, response_body)`, returns the canonical response.                                                                                                 |
| Retry with **same** key + **same** body            | Skips the handler. Replays the cached `(status, body)` byte-for-byte.                                                                                                                                      |
| Retry with **same** key + **different** body       | `409 IDEMPOTENCY_KEY_BODY_MISMATCH`. Indicates a client bug — the same key was reused with new data.                                                                                                       |
| Two parallel requests racing the same key          | One wins (stores the row); the other's handler also runs but the duplicate INSERT is swallowed (PK collision). Both return the canonical handler response. The next retry sees the cached row and replays. |

## Hash details

- The body hash is `sha256(JSON.stringify(body))`. JSON key order matters — clients should reuse the exact serialisation across retries to avoid accidental `409 IDEMPOTENCY_KEY_BODY_MISMATCH`.
- Empty / no body hashes the empty string (so `DELETE` and `PATCH` with no payload are also covered).

## Endpoints that accept `Idempotency-Key`

The following endpoints opt in via `@IdempotencyKey()`:

| Method   | Path                                        | Spec                                                              |
| -------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `POST`   | `/projects/business/:id/backlogs`           | [backlogs](../business-service/projects/backlogs-api-specs.md)    |
| `PATCH`  | `/projects/business/:id/backlogs/:taskId`   | [backlogs](../business-service/projects/backlogs-api-specs.md)    |
| `DELETE` | `/projects/business/:id/backlogs`           | [backlogs](../business-service/projects/backlogs-api-specs.md)    |
| `PATCH`  | `/projects/business/:id/settings`           | [settings](../business-service/projects/settings-api-specs.md)    |
| `PATCH`  | `/projects/business/:id/status`             | [projects](../business-service/projects/projects-api-specs.md)    |
| `POST`   | `/projects/business/:id/ai-sync/settings`   | [ai-sync](../business-service/projects/ai-sync-api-specs.md)      |
| `POST`   | `/projects/business/:id/ai-sync/skills`     | [ai-sync](../business-service/projects/ai-sync-api-specs.md)      |
| `POST`   | `/projects/business/:id/ai-sync/tasks`      | [ai-sync](../business-service/projects/ai-sync-api-specs.md)      |
| `POST`   | `/projects/:projectId/ai-context/decisions` | [ai-context](../business-service/ai-chat/ai-context-api-specs.md) |
