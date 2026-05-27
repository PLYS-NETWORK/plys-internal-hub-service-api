export type FilesStorageProviderName = 'local' | 's3' | 'gcs';

export interface IFilesConfig {
  /** Active storage backend. Only `local` is implemented in the current build. */
  readonly filesStorageProvider: FilesStorageProviderName;

  /** Maximum allowed bytes per upload, enforced at the multipart layer. */
  readonly filesMaxSizeBytes: number;

  /** Allow-list of MIME types (sniffed, not declared) accepted by the upload pipeline. */
  readonly filesAllowedMimeList: string[];

  /** Aggregate cap on bytes a single user may store across all non-soft-deleted files. */
  readonly filesUserQuotaBytes: number;

  /** Cap on number of active (non-soft-deleted) files per user. */
  readonly filesUserMaxCount: number;

  /** Soft-deleted files older than this many days are purged by the daily cron. */
  readonly filesPurgeAfterDays: number;

  /**
   * Grace window before an orphaned upload (purpose IS NULL, no attachment
   * references) is soft-deleted by the daily cron. Tunes the trade-off
   * between "users can finish their attach flow" and "we reclaim storage
   * promptly".
   */
  readonly filesOrphanGraceHours: number;

  /** Optional W*H cap for image uploads. `null` disables the check. */
  readonly filesMaxImagePixels: number | null;

  /** Filesystem root for the local provider. Must not be a symlink. */
  readonly filesLocalPath: string;

  /** Public base URL where local-provider files are served from. */
  readonly filesLocalPublicBaseUrl: string;
}
