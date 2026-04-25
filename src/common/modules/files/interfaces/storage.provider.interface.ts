import { FileStorageProvider } from '@database/enums';

import { IStoredObject } from './stored-object.interface';
import { IUploadInput } from './upload-input.interface';

/**
 * Strategy contract for a pluggable storage backend. Concrete
 * implementations adapt different SDKs (filesystem, S3, GCS) to this
 * unified interface. `FilesService` is bound to the active strategy
 * via the `STORAGE_PROVIDER` DI token and never references a concrete
 * provider class.
 */
export interface IStorageProvider {
  /** Identity of this provider — written to `file.storage_provider` on each row. */
  readonly name: FileStorageProvider;

  /**
   * Persists `input.buffer` under a freshly minted key derived from `keyHint`.
   * Implementations MUST NOT trust `keyHint` as a path — the local provider,
   * for example, treats it as a relative key beneath the configured root and
   * verifies the resolved path stays inside that root.
   *
   * @param input   Validated upload payload (sniffed MIME, sanitised name, size).
   * @param keyHint Server-generated relative key (e.g. `2026/04/<uuid>.png`).
   * @returns Stored-object descriptor with the canonical key + a fetchable URL.
   * @throws TranslatableException(FILE_STORAGE_ERROR) on backend failure.
   */
  put(input: IUploadInput, keyHint: string): Promise<IStoredObject>;

  /**
   * Returns a URL the client can use to fetch the stored object.
   * For the local provider this is a stable public URL; cloud providers
   * issue a short-lived presigned URL.
   *
   * @param key    Provider-internal key returned by `put`.
   * @param ttlSec Optional TTL for cloud presigned URLs; ignored by local.
   */
  getUrl(key: string, ttlSec?: number): Promise<string>;

  /**
   * Removes the stored object. Idempotent: if the object is already gone
   * the implementation MUST resolve cleanly so the daily cleanup cron can
   * progress to the row hard-delete.
   *
   * @param key Provider-internal key returned by `put`.
   * @throws TranslatableException(FILE_STORAGE_ERROR) on unrecoverable backend failure.
   */
  remove(key: string): Promise<void>;
}
