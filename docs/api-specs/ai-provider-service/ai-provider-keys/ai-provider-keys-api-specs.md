# AI Provider Keys — API Specs

> **Sources:**
>
> - BFF endpoint: [apps/ai-provider-service/src/modules/ai-provider-key/ai-provider-key-bff.controller.ts](../../../../apps/ai-provider-service/src/modules/ai-provider-key/ai-provider-key-bff.controller.ts)
> - Admin CRUD: [apps/ai-provider-service/src/modules/ai-provider-key/ai-provider-key-admin.controller.ts](../../../../apps/ai-provider-service/src/modules/ai-provider-key/ai-provider-key-admin.controller.ts)
> - Service: [apps/ai-provider-service/src/modules/ai-provider-key/ai-provider-key.service.ts](../../../../apps/ai-provider-service/src/modules/ai-provider-key/ai-provider-key.service.ts)
> - Crypto: [crypto/aes-gcm.ts](../../../../apps/ai-provider-service/src/modules/ai-provider-key/crypto/aes-gcm.ts), [crypto/master-key.cipher.ts](../../../../apps/ai-provider-service/src/modules/ai-provider-key/crypto/master-key.cipher.ts), [crypto/bff-envelope.cipher.ts](../../../../apps/ai-provider-service/src/modules/ai-provider-key/crypto/bff-envelope.cipher.ts)
>
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }`.

The vault stores model API keys (Groq, Gemini, OpenAI, …) so an admin can rotate them without redeploying the FE. The backend **never calls a model** itself — it stores the keys at rest and hands them to the FE BFF (the Next.js server) wrapped in a separate transport-encryption envelope. The browser never sees the plaintext.

## Encryption envelopes

Two AES-256-GCM key families, both **versioned**:

- `AI_KEYS_MASTER_KEY_v<N>` — wraps `ai_provider_api_key.key_ciphertext` at rest. Lives only on the gateway.
- `FE_BFF_SECRET_v<N>` — wraps the BFF response payload. Lives on both the gateway and the FE BFF.

Env shape:

```env
# Each value is a 32-byte secret encoded as base64 — 43 chars unpadded
# or 44 chars with `=` padding; standard or URL-safe alphabet.
# Generate with: `openssl rand -base64 32`
# Example:        C4oNA0X65aQQZ1y1n3MLugsCdCCRuFnsr1RxYhuGqEQ

AI_KEYS_MASTER_KEY_v1=<32-byte base64>
AI_KEYS_MASTER_KEY_v2=<32-byte base64>     # added during rotation, decrypts old rows
AI_KEYS_CURRENT_MASTER_VERSION=2

FE_BFF_SECRET_v1=<32-byte base64>
FE_BFF_SECRET_v2=<32-byte base64>
FE_BFF_CURRENT_VERSION=2
```

The cipher refuses to start if `currentVersion` doesn't reference a configured key, or if any configured value doesn't decode to exactly 32 bytes.

## Cross-cutting errors

| HTTP | error_code                      | When                                                                                    |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------- |
| 401  | `AUTH_UNAUTHORIZED`             | Missing/invalid Bearer token.                                                           |
| 403  | `GENERIC_FORBIDDEN`             | Caller lacks `ADMIN_PLATFORM` (admin endpoints only).                                   |
| 500  | `AI_PROVIDER_KEY_CIPHER_FAILED` | Cipher misconfiguration or auth-tag failure (logged with cause; never leaks plaintext). |

## BFF endpoint (any authenticated user)

### 1. Get the active key for an assistant type, encrypted under `FE_BFF_SECRET`

- **Endpoint:** `GET /ai-provider-keys/active`
- **Method:** `GET`
- **Query params:** [`GetActiveKeyQueryDto`](../../../../apps/ai-provider-service/src/modules/ai-provider-key/dto/requests/get-active-key.dto.ts)
  | Field | Type | Required | Notes |
  | ---------------- | -------------------------------------------------- | -------- | ----- |
  | `assistant_type` | `'chat_box' \| 'interview' \| 'evaluate_answer'` | yes | Which assistant feature is making the call. The gateway returns whichever active key powers that feature, regardless of the provider behind it. |
- **Behaviour:**
  1. Loads the row where `assistant_type = :assistant_type AND is_active = TRUE`.
  2. Decrypts `key_ciphertext` with `AI_KEYS_MASTER_KEY_v<row.master_key_version>`.
  3. Re-encrypts the plaintext with `FE_BFF_SECRET_v<currentVersion>`.
  4. Returns the envelope (including the row's `provider` so the BFF picks the right SDK). The plaintext is best-effort overwritten in stack-locals after the call.
- **Response 200:** [`IApiKeyBffResponse`](../../../../apps/ai-provider-service/src/modules/ai-provider-key/dto/responses/interfaces/api-key-bff.response.interface.ts) — see shape below.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 404 | `AI_PROVIDER_KEY_NOT_CONFIGURED` | No active key for `assistant_type`. The FE BFF should surface a friendly "AI chat unavailable — contact admin" message. |

```jsonc
{
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "key_envelope": {
    "version": 2 /* FE BFF picks FE_BFF_SECRET_v2 from its env */,
    "iv": "base64(12 bytes)",
    "tag": "base64(16 bytes)",
    "ciphertext": "base64(...)",
  },
  "key_last4": "8c2f" /* not the full plaintext — masking helper */,
  "expires_at": "2026-05-05T01:00:00.000Z" /* now() + 30m; FE caches until then */,
}
```

The FE BFF decrypts `key_envelope` with the matching version of `FE_BFF_SECRET` and uses the resulting plaintext to call the provider SDK directly. Cache the decrypted plaintext in process memory until `expires_at`, then re-fetch.

## Admin endpoints

Mounted under `/admin/ai-provider-keys`. `@Roles(ADMIN_PLATFORM)`.

### 2. List keys (masked, paginated)

- **Endpoint:** `GET /admin/ai-provider-keys`
- **Method:** `GET`
- **Query params:** [`ListApiKeysDto`](../../../../apps/ai-provider-service/src/modules/ai-provider-key/dto/requests/list-api-keys.dto.ts) — extends the standard `PageOptionsDto`.
  | Field | Type | Required | Default | Notes |
  | ---------------- | -------------------------------------------------- | -------- | ------- | ----- |
  | `page` | `number` | no | `1` | 1-indexed. Min 1. |
  | `limit` | `number` | no | `20` | Page size. Min 1, max 100. |
  | `sort_by` | `string` | no | — | Optional secondary column; active-first always applies first. |
  | `order_by` | `'ASC' \| 'DESC'` | no | — | Direction for `sort_by`. |
  | `assistant_type` | `'chat_box' \| 'interview' \| 'evaluate_answer'` | no | — | Filter to a single assistant feature. |
  | `model` | `string` | no | — | Exact-match (max length 80). |
  | `keywords` | `string` | no | — | Case-insensitive substring search on `label` (length 1–80). |
- **Ordering:** active keys are always sorted ahead of inactive ones, so page 1 surfaces the keys currently in rotation at the top. Sub-order: `assistant_type ASC, created_at DESC`.
- **Response 200:** `PageDto<IApiKeyAdminResponse>`. The plaintext is **never** in the response; `key_masked` is `<provider-prefix>***...<last4>`.
- **Errors:** cross-cutting only.

```jsonc
{
  "data": [
    {
      "id": "uuid",
      "assistant_type": "chat_box",
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "label": "groq-prod-2026-05",
      "master_key_version": 2,
      "key_masked": "gsk_***...8c2f",
      "is_active": true,
      "created_by": "uuid",
      "created_at": "2026-05-05T01:00:00.000Z",
      "updated_at": "2026-05-05T01:00:00.000Z",
    },
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "itemCount": 5,
    "pageCount": 1,
    "hasPreviousPage": false,
    "hasNextPage": false,
  },
}
```

### 3. Create a new key

- **Endpoint:** `POST /admin/ai-provider-keys`
- **Method:** `POST`
- **Request body:** [`ICreateApiKeyRequest`](../../../../apps/ai-provider-service/src/modules/ai-provider-key/dto/requests/interfaces/create-api-key.request.interface.ts)
  | Field | Type | Required | Notes |
  | ---------------- | -------------------------------------------------- | -------- | ----- |
  | `assistant_type` | `'chat_box' \| 'interview' \| 'evaluate_answer'` | yes | Which assistant feature this key powers. Acts as the active-key partition (one active row per type). |
  | `provider` | `'groq' \| 'gemini' \| 'openai'` | yes | Informational metadata so the FE BFF picks the right SDK. |
  | `model` | `string` | yes | length 1–80; passed verbatim to the provider SDK on the FE BFF (e.g. `'llama-3.3-70b-versatile'`). |
  | `label` | `string` | yes | length 1–80; admin-readable identifier. |
  | `key` | `string` | yes | length 8–200. Plaintext API key. Read once, encrypted under the current master key, discarded. **Never echoed back.** |
- **Behaviour (single transaction):** **the new row lands `is_active = true` and any previously active key for the same `assistant_type` is auto-deactivated.** Creating a key is therefore a one-step rotation — no follow-up activate call is required. The plaintext is overwritten on the stack after the encrypt call. To bring an _existing_ inactive key back into rotation without uploading new plaintext, use the activate endpoint (§5).
- **Response 201:** masked `IApiKeyAdminResponse` with `is_active = true`.
- **Errors:** cross-cutting only.

### 4. Update label / model

- **Endpoint:** `PATCH /admin/ai-provider-keys/:id`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4)
- **Request body:** [`IUpdateApiKeyRequest`](../../../../apps/ai-provider-service/src/modules/ai-provider-key/dto/requests/interfaces/update-api-key.request.interface.ts) — both fields optional.
  | Field | Type | Required | Notes |
  | ------- | -------- | -------- | ----- |
  | `model` | `string` | no | length 1–80. |
  | `label` | `string` | no | length 1–80. |
- **Behaviour:** the plaintext key cannot be rotated in place — to rotate the secret, create a new row and activate it.
- **Response 200:** masked `IApiKeyAdminResponse`.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 404 | `AI_PROVIDER_KEY_NOT_FOUND` | No row with that id. |

### 5. Activate a key

- **Endpoint:** `PATCH /admin/ai-provider-keys/:id/activate`
- **Method:** `PATCH`
- **Path params:** `id` (UUID v4)
- **Behaviour (single transaction):** **activating a key auto-deactivates the previously active key for the same `assistant_type`.** Both updates land in one transaction, so the BFF never sees a window with zero or two active keys for that assistant type. There is no separate "deactivate" endpoint — to swap the active key, just activate the new one. The partial unique index `uq_ai_provider_api_key_active_per_assistant_type` enforces "at most one active key per assistant_type" at the DB layer in case of a race.
- **Response 200:** masked `IApiKeyAdminResponse`.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 404 | `AI_PROVIDER_KEY_NOT_FOUND` | No row with that id. |

### 6. Revoke a key

- **Endpoint:** `DELETE /admin/ai-provider-keys/:id`
- **Method:** `DELETE`
- **Path params:** `id` (UUID v4)
- **Behaviour:** hard-deletes the row.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  | ---- | ---------- | ---- |
  | 404 | `AI_PROVIDER_KEY_NOT_FOUND` | No row with that id. |
  | 409 | `AI_PROVIDER_KEY_ACTIVE_REQUIRES_REPLACEMENT` | Target is the only active key for its assistant type; activate a replacement first. |

### 7. Re-encrypt every row to the current master key version

- **Endpoint:** `POST /admin/ai-provider-keys/_re-encrypt`
- **Method:** `POST`
- **Behaviour (single transaction):** iterates every row whose `master_key_version != currentVersion`, decrypts with the row's version, re-encrypts under the current version, and updates `master_key_version` + `key_ciphertext`. Idempotent — rows already on the current version are skipped.
- **Response 200:** `{ touched: number }` — count of rows rewritten.
- **Errors:** cross-cutting only.

## Rotation runbook

### Master key rotation (`AI_KEYS_MASTER_KEY`)

1. Add `AI_KEYS_MASTER_KEY_v<N+1>` to the gateway env. Keep `AI_KEYS_CURRENT_MASTER_VERSION=N`. Deploy. The service can decrypt with either version.
2. Cut over writes: `AI_KEYS_CURRENT_MASTER_VERSION=N+1`. Deploy. New rows use v(N+1); existing rows still readable via v(N).
3. Run `POST /admin/ai-provider-keys/_re-encrypt`. Verify with `SELECT DISTINCT master_key_version FROM ai_provider_api_key` (should return only the current version).
4. Retire v(N): remove `AI_KEYS_MASTER_KEY_v<N>` from env. Deploy.

### BFF secret rotation (`FE_BFF_SECRET`)

1. Add `FE_BFF_SECRET_v<N+1>` to **both** the gateway env and the FE BFF env. Keep `FE_BFF_CURRENT_VERSION=N`. Deploy both.
2. Cut over writes: `FE_BFF_CURRENT_VERSION=N+1` on the gateway. Deploy gateway.
3. Wait 30 minutes (the FE BFF's in-process cache TTL).
4. Retire v(N): remove `FE_BFF_SECRET_v<N>` from both envs. Deploy both.
