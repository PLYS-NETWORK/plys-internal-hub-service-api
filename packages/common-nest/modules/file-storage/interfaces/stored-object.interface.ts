/**
 * Result of a successful `IStorageProvider.put`. The `key` is the
 * provider-internal locator used for subsequent `getUrl` / `remove`
 * calls; it is also persisted on the DB row so the file remains
 * locatable after a default-provider switch.
 */
export interface IStoredObject {
  /** Provider-internal locator (filesystem path, S3 key, GCS object name). */
  readonly key: string;
  /** Externally fetchable URL (server route for local; presigned for cloud). */
  readonly url: string;
}
