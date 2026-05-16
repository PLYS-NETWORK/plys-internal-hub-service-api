# AI Provider Keys — Admin API

CRUD for the AI provider key vault. Only `ADMIN_PLATFORM` callers may use these endpoints. The plaintext API key crosses the wire **once** (on `POST /admin/ai-provider-keys`); after that it is encrypted at rest under the current `AI_KEYS_MASTER_KEY` version and never echoed back.

> **Sources**
>
> - Controller: [src/modules/ai-provider-key/ai-provider-key-admin.controller.ts](../../../../src/modules/ai-provider-key/ai-provider-key-admin.controller.ts)
> - Service: [src/modules/ai-provider-key/ai-provider-key.service.ts](../../../../src/modules/ai-provider-key/ai-provider-key.service.ts)
> - Request DTOs: [create-api-key.dto.ts](../../../../src/modules/ai-provider-key/dto/requests/create-api-key.dto.ts), [update-api-key.dto.ts](../../../../src/modules/ai-provider-key/dto/requests/update-api-key.dto.ts)
> - Response DTO: [api-key-admin-response.dto.ts](../../../../src/modules/ai-provider-key/dto/responses/api-key-admin-response.dto.ts)
>
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.

**Base path:** `/api/v1`
**Mount:** `/admin/ai-provider-keys`
**Required role:** `ADMIN_PLATFORM` (enforced by the global `RolesGuard` via `@Roles(UserRole.ADMIN_PLATFORM)` on the controller).
**Auth:** Bearer JWT (global `JwtAuthGuard`).

---

## Cross-cutting errors

These apply to every endpoint below in addition to the per-route table.

| HTTP | error_code                      | When                                                                                    |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`             | Missing or invalid Bearer token.                                                        |
| 403  | `GENERIC_FORBIDDEN`             | Authenticated caller lacks `ADMIN_PLATFORM` role.                                       |
| 422  | `GENERIC_VALIDATION_ERROR`      | Request body or path/query params failed `class-validator` checks.                      |
| 500  | `AI_PROVIDER_KEY_CIPHER_FAILED` | Cipher misconfiguration or auth-tag failure (logged with cause; never leaks plaintext). |

---

## Shared response shape — `IApiKeyAdminResponse`

Returned by every admin endpoint that produces a body. Plaintext is never present; `key_masked` is `<provider-prefix>***...<last4>`.

```jsonc
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "assistant_type": "chat_box",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "label": "groq-prod-2026-05",
  "master_key_version": 2,
  "key_masked": "gsk_***...8c2f",
  "is_active": false,
  "created_by": "8e3a1f6c-5c2b-4a8e-9f1d-2c5d7e9a4b6f",
  "created_at": "2026-05-05T01:00:00.000Z",
  "updated_at": "2026-05-05T01:00:00.000Z",
}
```

| Field                | Type                                             | Notes                                                                                 |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `id`                 | `string` (UUID v4)                               | Primary key.                                                                          |
| `assistant_type`     | `'chat_box' \| 'interview' \| 'evaluate_answer'` | Enum: `AiAssistantType`. Active-key partition — at most one `is_active` row per type. |
| `provider`           | `'groq' \| 'gemini' \| 'openai'`                 | Enum: `AiProvider`. Informational; tells the FE BFF which SDK to instantiate.         |
| `model`              | `string`                                         | Length 1–80. Verbatim model id passed to the provider SDK by the BFF.                 |
| `label`              | `string`                                         | Length 1–80. Admin-readable identifier.                                               |
| `master_key_version` | `number`                                         | Which `AI_KEYS_MASTER_KEY_v<N>` encrypts this row at rest.                            |
| `key_masked`         | `string`                                         | `<provider-prefix>***...<last4>` — never the plaintext.                               |
| `is_active`          | `boolean`                                        | At most one row per `assistant_type` may be `true` (enforced by partial uq).          |
| `created_by`         | `string` (UUID)                                  | The user who created the row.                                                         |
| `created_at`         | `string` (ISO 8601)                              |                                                                                       |
| `updated_at`         | `string` (ISO 8601)                              |                                                                                       |

---

## Endpoints

### 1. List keys (masked, paginated)

`GET /admin/ai-provider-keys`

> **Ordering:** active keys are always sorted ahead of inactive ones, so page 1 surfaces the keys currently in rotation at the top — even when the caller doesn't filter by `assistant_type`. Within active and inactive groups, rows are sub-ordered by `assistant_type ASC` then `created_at DESC`.

#### Headers

| Header          | Required | Description    |
| --------------- | -------- | -------------- |
| `Authorization` | Yes      | `Bearer <JWT>` |

#### Query params

| Field            | Type                                             | Required | Default | Notes                                                                                         |
| ---------------- | ------------------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `page`           | `number`                                         | No       | `1`     | 1-indexed page number. Min 1.                                                                 |
| `limit`          | `number`                                         | No       | `20`    | Page size. Min 1, max 100.                                                                    |
| `sort_by`        | `string`                                         | No       | —       | Optional secondary sort column (entity-level). Active-first ordering is always applied first. |
| `order_by`       | `'ASC' \| 'DESC'`                                | No       | —       | Direction for `sort_by`.                                                                      |
| `assistant_type` | `'chat_box' \| 'interview' \| 'evaluate_answer'` | No       | —       | Filter to a single assistant feature.                                                         |
| `model`          | `string`                                         | No       | —       | Exact-match filter on the model identifier (max length 80).                                   |
| `keywords`       | `string`                                         | No       | —       | Case-insensitive substring search on `label`. Length 1–80.                                    |

#### Responses

**200 OK** — `PageDto<IApiKeyAdminResponse>`. `data` is empty if no rows match.

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "assistant_type": "chat_box",
        "provider": "groq",
        "model": "llama-3.3-70b-versatile",
        "label": "groq-prod-2026-05",
        "master_key_version": 2,
        "key_masked": "gsk_***...8c2f",
        "is_active": true,
        "created_by": "8e3a1f6c-5c2b-4a8e-9f1d-2c5d7e9a4b6f",
        "created_at": "2026-05-05T01:00:00.000Z",
        "updated_at": "2026-05-05T01:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "itemCount": 5,
      "pageCount": 1,
      "hasPreviousPage": false,
      "hasNextPage": false
    }
  },
  "timestamp": "2026-05-08T12:00:00.000Z",
  "path": "/api/v1/admin/ai-provider-keys"
}
```

#### Errors

Cross-cutting only.

---

### 2. Create and activate a new key

`POST /admin/ai-provider-keys`

Plaintext is read once, encrypted under the current `AI_KEYS_MASTER_KEY` version, then discarded.

> **Side effect (auto-activation + auto-deactivation):** the new row lands `is_active = true` and any previously active key for the same `assistant_type` is set to `is_active = false` in the same transaction. Creating a key is a one-step rotation — no follow-up activate call is needed. The BFF never observes a window with zero or two active keys for that assistant_type.
>
> To bring an _existing_ inactive key back into rotation without uploading new plaintext, use [§4 Activate a key](#4-activate-a-key) instead.

#### Headers

| Header          | Required | Description        |
| --------------- | -------- | ------------------ |
| `Authorization` | Yes      | `Bearer <JWT>`     |
| `Content-Type`  | Yes      | `application/json` |

#### Request body — `CreateApiKeyDto`

```json
{
  "assistant_type": "chat_box",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "label": "groq-prod-2026-05",
  "key": "gsk_live_abcdef0123456789...8c2f"
}
```

| Field            | Type                                             | Required | Constraints                                                                                                          |
| ---------------- | ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `assistant_type` | `'chat_box' \| 'interview' \| 'evaluate_answer'` | Yes      | Enum: `AiAssistantType`. Determines which assistant feature this key powers; partition for the active-key invariant. |
| `provider`       | `'groq' \| 'gemini' \| 'openai'`                 | Yes      | Enum: `AiProvider`. Informational; tells the FE BFF which SDK to instantiate.                                        |
| `model`          | `string`                                         | Yes      | Length 1–80.                                                                                                         |
| `label`          | `string`                                         | Yes      | Length 1–80.                                                                                                         |
| `key`            | `string`                                         | Yes      | Length 8–200. Plaintext API key. Read once, encrypted at rest. **Never echoed back.**                                |

#### Responses

**201 Created** — masked `IApiKeyAdminResponse`. `is_active` is always `true`.

```json
{
  "status_code": 201,
  "message": "Created",
  "error_code": null,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "assistant_type": "chat_box",
    "provider": "groq",
    "model": "llama-3.3-70b-versatile",
    "label": "groq-prod-2026-05",
    "master_key_version": 2,
    "key_masked": "gsk_***...8c2f",
    "is_active": true,
    "created_by": "8e3a1f6c-5c2b-4a8e-9f1d-2c5d7e9a4b6f",
    "created_at": "2026-05-08T12:00:00.000Z",
    "updated_at": "2026-05-08T12:00:00.000Z"
  },
  "timestamp": "2026-05-08T12:00:00.000Z",
  "path": "/api/v1/admin/ai-provider-keys"
}
```

#### Errors

Cross-cutting only.

---

### 3. Update label / model

`PATCH /admin/ai-provider-keys/:id`

The plaintext key cannot be rotated in place. To rotate the secret, create a new row (which activates it and auto-deactivates the prior active row for the same `assistant_type` — see [§2](#2-create-and-activate-a-new-key)). The partial unique index `uq_ai_provider_api_key_active_per_assistant_type` keeps the active-key invariant safe.

#### Headers

| Header          | Required | Description        |
| --------------- | -------- | ------------------ |
| `Authorization` | Yes      | `Bearer <JWT>`     |
| `Content-Type`  | Yes      | `application/json` |

#### Path params

| Name | Type          | Notes                         |
| ---- | ------------- | ----------------------------- |
| `id` | `string` UUID | Validated by `ParseUUIDPipe`. |

#### Request body — `UpdateApiKeyDto`

Both fields optional. Send only the keys you want to change.

```json
{
  "model": "llama-3.3-70b-versatile",
  "label": "groq-prod-2026-05"
}
```

| Field   | Type     | Required | Constraints  |
| ------- | -------- | -------- | ------------ |
| `model` | `string` | No       | Length 1–80. |
| `label` | `string` | No       | Length 1–80. |

#### Responses

**200 OK** — masked `IApiKeyAdminResponse` reflecting the updated row.

#### Errors

| HTTP | error_code                  | When                   |
| ---- | --------------------------- | ---------------------- |
| 404  | `AI_PROVIDER_KEY_NOT_FOUND` | No row with that `id`. |

---

### 4. Activate a key

`PATCH /admin/ai-provider-keys/:id/activate`

> **Side effect (auto-deactivation):** activating a key automatically sets the previously active key for the same `assistant_type` to `is_active = false`. Both updates run in a single transaction so the BFF never observes a window with zero or two active keys for the assistant type. There is no separate "deactivate" endpoint — flipping the active key is always a single activate call on the new target.

The partial unique index `uq_ai_provider_api_key_active_per_assistant_type` enforces "at most one active key per assistant_type" at the DB layer in case of a race.

#### Example transition

| Before                                                                                                     | Action                                     | After                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Key A: `assistant_type=chat_box`, `is_active=true`<br>Key B: `assistant_type=chat_box`, `is_active=false`  | `PATCH /admin/ai-provider-keys/B/activate` | Key A: `assistant_type=chat_box`, `is_active=false`<br>Key B: `assistant_type=chat_box`, `is_active=true` |
| Key A: `assistant_type=chat_box`, `is_active=true`<br>Key C: `assistant_type=interview`, `is_active=false` | `PATCH /admin/ai-provider-keys/C/activate` | Key A: unchanged (different assistant_type)<br>Key C: `assistant_type=interview`, `is_active=true`        |

#### Headers

| Header          | Required | Description    |
| --------------- | -------- | -------------- |
| `Authorization` | Yes      | `Bearer <JWT>` |

#### Path params

| Name | Type          | Notes                         |
| ---- | ------------- | ----------------------------- |
| `id` | `string` UUID | Validated by `ParseUUIDPipe`. |

#### Request body

Empty.

#### Responses

**200 OK** — masked `IApiKeyAdminResponse` with `is_active: true`.

#### Errors

| HTTP | error_code                  | When                   |
| ---- | --------------------------- | ---------------------- |
| 404  | `AI_PROVIDER_KEY_NOT_FOUND` | No row with that `id`. |

---

### 5. Revoke a key

`DELETE /admin/ai-provider-keys/:id`

Hard-deletes the row. To prevent accidentally cutting off the BFF, the service refuses to delete the **only** active key for an `assistant_type` — activate (or create) a replacement first.

#### Headers

| Header          | Required | Description    |
| --------------- | -------- | -------------- |
| `Authorization` | Yes      | `Bearer <JWT>` |

#### Path params

| Name | Type          | Notes                         |
| ---- | ------------- | ----------------------------- |
| `id` | `string` UUID | Validated by `ParseUUIDPipe`. |

#### Responses

**204 No Content** — empty body.

#### Errors

| HTTP | error_code                                    | When                                                                                  |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| 404  | `AI_PROVIDER_KEY_NOT_FOUND`                   | No row with that `id`.                                                                |
| 409  | `AI_PROVIDER_KEY_ACTIVE_REQUIRES_REPLACEMENT` | Target is the only active key for its `assistant_type`; activate a replacement first. |

---

### 6. Re-encrypt every row to the current master key version

`POST /admin/ai-provider-keys/_re-encrypt`

Run after rotating `AI_KEYS_MASTER_KEY`. Single transaction: iterates every row whose `master_key_version != currentVersion`, decrypts with the row's old version, re-encrypts under the current version, and updates `master_key_version` + `key_ciphertext`. Idempotent — rows already on the current version are skipped.

#### Headers

| Header          | Required | Description    |
| --------------- | -------- | -------------- |
| `Authorization` | Yes      | `Bearer <JWT>` |

#### Request body

Empty.

#### Responses

**200 OK**

```json
{
  "status_code": 200,
  "message": "OK",
  "error_code": null,
  "data": {
    "touched": 3
  },
  "timestamp": "2026-05-08T12:00:00.000Z",
  "path": "/api/v1/admin/ai-provider-keys/_re-encrypt"
}
```

| Field     | Type     | Notes                                                             |
| --------- | -------- | ----------------------------------------------------------------- |
| `touched` | `number` | Count of rows rewritten. `0` means every row was already current. |

#### Errors

Cross-cutting only.

---

## Rotation runbook (master key)

1. Add `AI_KEYS_MASTER_KEY_v<N+1>` to the gateway env. Keep `AI_KEYS_CURRENT_MASTER_VERSION=N`. Deploy. The service can decrypt with either version.
2. Cut over writes: `AI_KEYS_CURRENT_MASTER_VERSION=N+1`. Deploy. New rows use v(N+1); existing rows stay readable via v(N).
3. Run `POST /admin/ai-provider-keys/_re-encrypt`. Verify with `SELECT DISTINCT master_key_version FROM ai_provider_api_key` — should return only the current version.
4. Retire v(N): remove `AI_KEYS_MASTER_KEY_v<N>` from env. Deploy.

## Rotating an actual provider key

The plaintext is immutable on a row. To rotate:

1. `POST /admin/ai-provider-keys` with the new plaintext, the same `assistant_type`, and whichever `provider` you want this assistant to talk to (can be a different provider from the one currently active — the partition is on `assistant_type`). The new row lands `is_active = true` and the previously active row for that `assistant_type` is auto-deactivated in the same transaction. The BFF picks up the new key on its next 30-minute cache miss.
2. (Optional) `DELETE /admin/ai-provider-keys/:oldId` once you're confident no in-flight BFF cache still references it.

To roll **back** to a previously-active (now inactive) key without uploading new plaintext, use [§4 Activate a key](#4-activate-a-key) on the older row.
