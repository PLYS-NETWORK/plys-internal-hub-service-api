# FilesController — API Specs

> **Source:** [apps/platform-service/src/modules/files/files.controller.ts](../../../apps/platform-service/src/modules/files/files.controller.ts)
> **Base path:** `/api/v1/files`
> **Scope (applies to every endpoint):** Bearer auth (`@ApiBearerAuth`). The global `JwtAuthGuard` rejects unauthenticated calls; no `@Roles` / `@Platform` are declared, so any authenticated user may use the module subject to per-endpoint ownership rules below.
> **Response envelope:** `TransformResponseInterceptor` wraps every body in `{ status_code, message, error_code, data, timestamp, path }` — **except** `GET /files/:id/download`, which writes the raw bytes (or a `302` redirect) and bypasses the envelope.
> **Field-name convention:** request/response columns use **snake_case** (the JSON contract).
> **Storage backend:** controlled by `FILES_STORAGE_PROVIDER` (`local` or `s3`). The active provider is bound to the `STORAGE_PROVIDER` DI token via [FileStorageModule](../../../packages/common-nest/modules/file-storage/file-storage.module.ts). Each `files` row records the provider it was written under, so a row authored under one backend is still locatable after the active default flips.

## Quotas, limits, and configuration

The service consults `EnvironmentsService` (driven by `.env`) at every request:

| Env var                       | Default                                | Used in                                                                                                                                                                                               |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FILES_STORAGE_PROVIDER`      | `local`                                | Selects active provider (`local` \| `s3` \| reserved `gcs`).                                                                                                                                          |
| `FILES_MAX_SIZE_BYTES`        | `52428800` (50 MiB)                    | Multipart hard cap (Fastify aborts mid-stream).                                                                                                                                                       |
| `FILES_ALLOWED_MIME`          | `image/png,image/jpeg,application/pdf` | Magic-byte sniffed MIME must match this list.                                                                                                                                                         |
| `FILES_USER_QUOTA_BYTES`      | `524288000` (500 MiB)                  | Per-owner cap, enforced **only on local provider**.                                                                                                                                                   |
| `FILES_USER_MAX_COUNT`        | `1000`                                 | Per-owner row count cap, **local provider only**.                                                                                                                                                     |
| `FILES_PURGE_AFTER_DAYS`      | `30`                                   | Soft-delete retention before bytes + row are reclaimed.                                                                                                                                               |
| `FILES_ORPHAN_GRACE_HOURS`    | `24`                                   | `purpose IS NULL` rows older than this are weekly-swept.                                                                                                                                              |
| `FILES_MAX_IMAGE_PIXELS`      | _unset_                                | Optional W×H cap for images (disabled when blank).                                                                                                                                                    |
| `FILES_LOCAL_PATH`            | `./uploads`                            | Local provider root (resolved + symlink-checked at boot).                                                                                                                                             |
| `FILES_LOCAL_PUBLIC_BASE_URL` | `http://localhost:3000/uploads`        | Used by `IStorageProvider.getUrl` to build the URL stamped onto `task_attachments.file_url` snapshots. **Not surfaced in API responses anymore** — clients fetch bytes via `GET /files/:id/download`. |
| `AWS_S3_PRESIGN_TTL_SECONDS`  | provider default                       | Default presigned-GET TTL on the S3 provider.                                                                                                                                                         |

## Cross-cutting errors

| HTTP | error_code           | When                                                                                 |
| ---- | -------------------- | ------------------------------------------------------------------------------------ |
| 401  | `AUTH_UNAUTHORIZED`  | Missing/invalid Bearer token (global `JwtAuthGuard`).                                |
| 404  | `FILE_NOT_FOUND`     | Row missing, soft-deleted, or owned by a different non-admin caller (no-leak 404).   |
| 500  | `FILE_STORAGE_ERROR` | Underlying provider rejected the call (S3 SDK error, fs IO error other than ENOENT). |

## Ownership model

`FilesService.loadOwnedOrThrow` enforces:

- The row exists and is not soft-deleted (`findByActiveId`).
- The caller is either the row's `owner_user_id`, **or** the caller has `UserRole.ADMIN_PLATFORM`.

Callers that don't satisfy either receive `404 FILE_NOT_FOUND` (never `403`) so the endpoint cannot be used to enumerate file IDs.

> **Cross-team access caveat:** task attachments stored under one user's `owner_user_id` cannot be downloaded by other project members through `/files/:id/download` because they are not the owner. For shared-resource flows (e.g. an assigned consultant downloading a brief uploaded by the business owner) use the project-scoped attachment route, not this endpoint.

## File lifecycle

```
   POST /files                                              POST /files?purpose=consultant_cv
   (no purpose param — default flow)                        POST /files?purpose=avatar
                                                            (CV / avatar upload — stamped at create time)
        │                                                          │
        ▼                                                          ▼
   row.purpose = NULL                                       row.purpose = 'consultant_cv' | 'avatar'
   key: <yyyy>/<mm>/<uuid>.<ext>                            key: consultant-CVs/<NODE_ENV>/<yyyy>/<mm>/<uuid>.<ext>
                                                            key: avatars/<NODE_ENV>/<yyyy>/<mm>/<uuid>.<ext>
        │                                                          │
   orphan grace window (FILES_ORPHAN_GRACE_HOURS)                  │
   Mon 03:00 UTC sweep → soft-deleted                              │
        │                                                          │
        ▼                                                          ▼
   attached by another surface                              consultant passes the returned `url`
   (e.g. POST /projects/.../attachments)                    as cv_url / avatar_url to
                                                            POST /consultant/onboarding/profile.
   row.purpose = '<task_attachment | task_comment | task_result>'
        │
        ▼
   detached / DELETE /files/:id  →  soft-delete (deleted_at NOT NULL)
        │
        ▼
   daily 03:00 UTC cron purges bytes + row
   after FILES_PURGE_AFTER_DAYS
```

The cron is implemented in [FilesCleanupService](../../../apps/platform-service/src/modules/files/files-cleanup.service.ts).

### `?purpose=consultant_cv` / `?purpose=avatar` — special cases stamped at upload time

The optional `purpose` query parameter is normally ignored at upload time (the owning surface stamps `purpose` later via `markAsAttached`). **Two values are honoured immediately**: `?purpose=consultant_cv` and `?purpose=avatar`. When the consultant passes either:

1. The storage key is prefixed:
   - `consultant_cv` → `consultant-CVs/<NODE_ENV>/<yyyy>/<mm>/<uuid>.<ext>`
   - `avatar` → `avatars/<NODE_ENV>/<yyyy>/<mm>/<uuid>.<ext>`

   instead of the default sharded `<yyyy>/<mm>/<uuid>.<ext>`. Same provider routing applies (`local` vs `s3`); just the prefix differs.

2. The `files.purpose` column is stamped with the matching value immediately (no `markAsAttached` round-trip), so the orphan-cleanup sweep ignores the row.
3. The response `url` is what the consultant passes as `cv_url` / `avatar_url` to `POST /consultant/onboarding/profile` (Step 1 of the onboarding flow).

Any other value of `purpose` is silently ignored — every legacy / non-stamped caller keeps working unchanged. The endpoint is shared, so size limits, MIME validation, and per-user quotas all apply identically.

## Endpoints

### 1. Upload a file

- **Endpoint:** `POST /files`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`, `Authorization: Bearer <token>`
- **Body:** multipart form with a single `file` field (binary). `@fastify/multipart` is configured for **at most 1 file** and `limits.fileSize = FILES_MAX_SIZE_BYTES`; the stream is aborted the instant the cap is exceeded so over-size bytes never reach memory or disk.
- **Behaviour:**
  1. Reads the multipart part. Missing part → `400 FILE_UPLOAD_FAILED`.
  2. Buffers the bytes. If `@fastify/multipart` raises `FST_REQ_FILE_TOO_LARGE` mid-stream → `413 FILE_SIZE_EXCEEDED`.
  3. `FileContentValidator` validates: empty/over-cap → `413 FILE_SIZE_EXCEEDED`; missing or non-allow-listed sniffed MIME → `415 FILE_INVALID_TYPE`. The MIME is **always** taken from the magic-byte sniff, never the client `Content-Type` header. The original filename is sanitised (NFC, control chars + path separators stripped, capped at 255 chars).
  4. **Local provider only:** rejects the upload if the caller would breach `FILES_USER_QUOTA_BYTES` or `FILES_USER_MAX_COUNT` → `413 FILE_QUOTA_EXCEEDED`. (S3 has no per-user quota wired.)
  5. Generates a server-side key `yyyy/mm/<uuid>.<ext>` (sharded to avoid huge flat directories on disk; the extension comes from the sniffed MIME, not the client filename).
  6. Computes `sha256` of the bytes and writes the row with `purpose = NULL`.
  7. Calls `IStorageProvider.put` to persist the bytes:
     - **Local:** `O_WRONLY | O_CREAT | O_EXCL`, mode `0600`. The realpath is re-checked after the write to defend against TOCTOU symlink races; a path that escapes the root is unlinked + rejected.
     - **S3:** `PutObjectCommand` to `AWS_S3_DEFAULT_BUCKET` with the env-prefixed key (`<NODE_ENV>/<key>`).
  8. Returns the new row + a fresh URL (presigned for S3, public static URL for local — exposed only via the `url` field on the response, not stored on consumer rows).
- **Response 201:** `IFileResponse`

  ```ts
  {
    id: string,                  // UUID v4 — referenced as file_id by attachment endpoints
    owner_user_id: string,       // UUID v4 — caller's user id
    mime_type: string,           // sniffed magic-byte MIME (never the client header)
    size_bytes: number,          // bytes
    original_name: string,       // sanitised display name
    purpose: string | null,      // null until another surface attaches the file
    url: string,                 // fresh URL — convenience only; clients should prefer GET /files/:id/download
    created_at: string           // ISO-8601 UTC
  }
  ```

- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 400 | `FILE_UPLOAD_FAILED` | Multipart part missing, or unexpected upload pipeline failure. |
  | 413 | `FILE_SIZE_EXCEEDED` | Empty buffer, or buffer exceeds `FILES_MAX_SIZE_BYTES` either before or mid-stream. |
  | 413 | `FILE_QUOTA_EXCEEDED` | Local provider — per-user byte cap or row-count cap reached. |
  | 415 | `FILE_INVALID_TYPE` | Sniffed MIME missing or not in `FILES_ALLOWED_MIME`. |
  | 415 | `FILE_DIMENSIONS_EXCEEDED` | Image exceeds optional `FILES_MAX_IMAGE_PIXELS` cap. |
  | 500 | `FILE_STORAGE_ERROR` | Provider write failed (disk error, S3 SDK error, escape-after-realpath). |

### 2. Get a file's metadata

- **Endpoint:** `GET /files/:id`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Behaviour:**
  - Loads the row through `loadOwnedOrThrow` (owner-or-admin gate; soft-deletes excluded). On miss → `404 FILE_NOT_FOUND`.
  - Calls `IStorageProvider.getUrl(storageKey)` to mint a fresh URL at call time:
    - **Local:** stable public URL (no signing).
    - **S3:** new presigned GET URL (TTL = `AWS_S3_PRESIGN_TTL_SECONDS`).
- **Response 200:** `IFileResponse` (same shape as `POST /files`).
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `FILE_NOT_FOUND` | Row missing/soft-deleted, or caller is neither owner nor admin. |
  | 500 | `FILE_STORAGE_ERROR` | URL generation failed (S3 presign error). |

### 3. Download a file (authenticated, ownership-enforced)

- **Endpoint:** `GET /files/:id/download`
- **Method:** `GET`
- **Path params:** `id` (UUID v4)
- **Response envelope:** **bypassed.** This endpoint takes over the Fastify reply and writes raw bytes (or a `302`) directly — there is no `{ status_code, message, … }` wrapper.
- **Behaviour:**
  - Runs the same `loadOwnedOrThrow` gate as `GET /files/:id`.
  - Routes by the row's `storage_provider`, **not** the active default — so a file written when the default was `local` keeps streaming from disk even after the default flips to `s3`, and vice versa.
  - **Local provider** → `IStorageProvider.download(key)` returns `{ kind: 'stream' }`. The controller writes:
    - `Content-Type: <sniffed mime_type>`
    - `Content-Length: <size_bytes>`
    - `Content-Disposition: attachment; filename="<ascii-fallback>"; filename*=UTF-8''<percent-encoded-original_name>` (RFC 5987 — both forms emitted for legacy + modern client coverage)
    - Then pipes the `fs.createReadStream` of the resolved-safe path. A pre-flight `fs.stat` surfaces `404 FILE_NOT_FOUND` for missing-on-disk before any bytes are written, so the response never half-emits.
  - **S3 provider** → `IStorageProvider.download(key)` returns `{ kind: 'redirect' }` with a presigned GET URL signed for **60 seconds** (intentionally tight — the URL is consumed immediately by the browser following the 302). The controller emits `302 Found` with `Location: <presigned-url>`.
- **Response 200 (local):** binary stream. `Content-Disposition` forces download even when the MIME is browser-renderable; remove the `attachment;` form client-side if inline rendering is desired.
- **Response 302 (S3):** empty body, `Location` header points to the short-lived presigned URL.
- **Errors:** raised before the Fastify reply is hijacked, so they go through the standard error envelope.
  | HTTP | error_code | When |
  |------|------------|------|
  | 401 | `AUTH_UNAUTHORIZED` | Missing/invalid bearer token. |
  | 404 | `FILE_NOT_FOUND` | Row missing, soft-deleted, owned by another non-admin user, or local bytes missing on disk (ENOENT). |
  | 500 | `FILE_STORAGE_ERROR` | Local stat failed for non-ENOENT reason, or S3 presign failed. |

### 4. Soft-delete a file

- **Endpoint:** `DELETE /files/:id`
- **Method:** `DELETE`
- **Path params:** `id` (UUID v4)
- **Behaviour:**
  - `loadOwnedOrThrow` gate — same rules as the read endpoints.
  - Sets `files.deleted_at = NOW()`. **Does not** delete bytes synchronously: the daily 03:00 UTC `purgeExpiredSoftDeletes` cron physically removes the byte object and hard-deletes the row once `deleted_at` exceeds `FILES_PURGE_AFTER_DAYS`.
  - Idempotent in effect — a second call against the same id returns `404 FILE_NOT_FOUND` because the row is already soft-deleted.
  - **Does not** detach this file from any `task_attachments` / `task_result_attachments` row that snapshotted it. Attachment surfaces own their own soft-delete + orphan flow via `files.markAsOrphaned`.
- **Response 204:** empty body.
- **Errors:**
  | HTTP | error_code | When |
  |------|------------|------|
  | 404 | `FILE_NOT_FOUND` | Row missing/soft-deleted or not owned. |

---

## Cross-links

- **Storage adapter contract:** [`IStorageProvider`](../../../packages/common-nest/modules/file-storage/interfaces/storage.provider.interface.ts) — `put` / `getUrl` / `download` / `remove`. Concrete adapters: [LocalStorageProvider](../../../packages/common-nest/modules/file-storage/providers/local-storage.provider.ts), [S3StorageProvider](../../../packages/common-nest/modules/file-storage/providers/s3-storage.provider.ts).
- **Service:** [FilesService](../../../apps/platform-service/src/modules/files/files.service.ts) — owns ownership gating, quota enforcement, sha256 hashing, and the `loadOwnedOrThrow` no-leak rule.
- **Cleanup cron:** [FilesCleanupService](../../../apps/platform-service/src/modules/files/files-cleanup.service.ts) — weekly orphan sweep (`purpose IS NULL` and unreferenced) and daily soft-delete reclamation.
- **Attachment surfaces (consume `file_id`):**
  - [task-attachments-api-specs.md](../business-service/projects/task-attachments-api-specs.md) — business owner's brief/reference uploads.
  - Board task results — see [board-api-specs.md](../business-service/projects/board-api-specs.md) (business view) and [board-api-specs.md](../consultant-service/projects/board-api-specs.md) (consultant view). Attachments expose `file_id` only; clients call `GET /files/:file_id/download` for bytes.
