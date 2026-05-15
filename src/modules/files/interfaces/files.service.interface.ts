import { IDownloadHandle, IUploadInput } from '@common/modules/file-storage';
import { FilePurpose } from '@database/enums';

import { FileResponseDto } from '../dto/responses';

/**
 * Returned by `IFilesService.download` — combines the provider-specific
 * handle (stream for local, redirect URL for cloud) with the metadata the
 * controller needs to write Content-Type, Content-Length, and
 * Content-Disposition headers.
 */
export interface IFileDownloadResult {
  readonly handle: IDownloadHandle;
  readonly mimeType: string;
  readonly originalName: string;
  readonly sizeBytes: number;
}

/**
 * Public contract for the files feature module — DB-tracked file rows
 * with ownership, quota, soft delete, and lifecycle. Wraps the lower-level
 * `IStorageProvider` (from `@common/modules/file-storage`) with persistence
 * and access control.
 */
export interface IFilesService {
  /**
   * Validates and stores an uploaded file. Caller is responsible for
   * sniffing/sanitising the input via `FileContentValidator` first.
   *
   * The optional `purpose` argument is the only purpose the client may set
   * at upload time. When omitted (the default), `purpose` stays NULL and
   * the storage key follows the default `yyyy/mm/uuid` shard.
   *
   * When `purpose === FilePurpose.CONSULTANT_CV`, the storage key is prefixed
   * with `consultant-CVs/<env>/...`. When `purpose === FilePurpose.AVATAR`,
   * the storage key is prefixed with `avatars/<env>/...`. Both purposes are
   * stamped on the row immediately so the orphan-cleanup cron skips them.
   * All other purposes remain NULL at upload time — they are attached later
   * via `IFileRepository.markAsAttached`.
   *
   * @param input Validated upload payload.
   * @param purpose Optional upload-time purpose marker; only `CONSULTANT_CV` and `AVATAR` are honoured here.
   * @returns Snake_case DTO with id + fresh URL.
   * @throws TranslatableException(FILE_QUOTA_EXCEEDED) when the user is over quota.
   * @throws TranslatableException(FILE_UPLOAD_FAILED)  on unexpected failure.
   * @throws TranslatableException(FILE_STORAGE_ERROR)  when the backend rejects the write.
   */
  upload(input: IUploadInput, purpose?: FilePurpose): Promise<FileResponseDto>;

  /**
   * Loads metadata + a freshly issued URL for a single file. Enforces
   * ownership: non-ADMIN callers may only read their own files.
   *
   * @param id File UUID.
   * @returns Snake_case DTO including the URL valid at call time.
   * @throws TranslatableException(FILE_NOT_FOUND, 404) if missing or not owned.
   */
  getById(id: string): Promise<FileResponseDto>;

  /**
   * Resolves a file by id with ownership enforced and returns a download
   * handle (stream for local, redirect URL for cloud) plus the metadata
   * needed to write Content-Type / Content-Length / Content-Disposition
   * response headers. Used by `GET /files/:id/download` to serve bytes
   * behind authentication instead of via a public static URL.
   *
   * @param id File UUID.
   * @returns Discriminated handle + display metadata.
   * @throws TranslatableException(FILE_NOT_FOUND, 404) if missing or not owned.
   * @throws TranslatableException(FILE_STORAGE_ERROR) on backend failure.
   */
  download(id: string): Promise<IFileDownloadResult>;

  /**
   * Soft-deletes the file row and leaves bytes in place; the daily cron
   * (`FilesCleanupService`) reclaims them after `FILES_PURGE_AFTER_DAYS`.
   *
   * @param id File UUID.
   * @throws TranslatableException(FILE_NOT_FOUND, 404) if missing or not owned.
   * @throws TranslatableException(FILE_DELETE_FAILED) on backend failure.
   */
  remove(id: string): Promise<void>;
}
