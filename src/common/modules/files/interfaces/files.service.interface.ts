import { FileResponseDto } from '../dto/responses';
import { IUploadInput } from './upload-input.interface';

/**
 * Public contract for the files module. Feature modules (profile avatar,
 * project attachments, etc.) inject `FilesService` and call these methods
 * directly; the HTTP controller is a thin wrapper over the same surface.
 */
export interface IFilesService {
  /**
   * Validates and stores an uploaded file. The caller is responsible for
   * sniffing/sanitising the input via `FileContentValidator` first.
   *
   * @param input Validated upload payload.
   * @param opts  Optional metadata: `purpose` tags the row for downstream filtering.
   * @returns Snake_case DTO with id + fresh URL.
   * @throws TranslatableException(FILE_QUOTA_EXCEEDED) when the user is over quota.
   * @throws TranslatableException(FILE_UPLOAD_FAILED) on unexpected failure.
   * @throws TranslatableException(FILE_STORAGE_ERROR) when the backend rejects the write.
   */
  upload(input: IUploadInput, opts?: { purpose?: string }): Promise<FileResponseDto>;

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
   * Soft-deletes the file row and leaves bytes in place; the daily cron
   * (`FilesCleanupService`) reclaims them after `FILES_PURGE_AFTER_DAYS`.
   *
   * @param id File UUID.
   * @throws TranslatableException(FILE_NOT_FOUND, 404) if missing or not owned.
   * @throws TranslatableException(FILE_DELETE_FAILED) on backend failure.
   */
  remove(id: string): Promise<void>;
}
