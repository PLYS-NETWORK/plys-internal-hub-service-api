import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { FileEntity } from '@plys/libraries/database/entities';
import { FilePurpose } from '@plys/libraries/database/enums';

export interface IFileRepository extends AbstractRepository<FileEntity> {
  /**
   * Sums `size_bytes` across all active (non-soft-deleted) rows owned by
   * the user. Used to enforce the per-user storage quota before accepting
   * a new upload.
   *
   * @param ownerUserId UUID of the owning user.
   * @returns Total bytes currently stored by the user (0 when no rows).
   */
  sumActiveBytesByOwner(ownerUserId: string): Promise<number>;

  /**
   * Counts active (non-soft-deleted) files owned by the user. Used to
   * enforce the per-user file-count cap.
   *
   * @param ownerUserId UUID of the owning user.
   */
  countActiveByOwner(ownerUserId: string): Promise<number>;

  /**
   * Returns soft-deleted files whose `deleted_at` is older than `cutoff`,
   * up to `limit` rows. Drives the daily purge cron — caller iterates the
   * result, removes the underlying bytes, then hard-deletes the row.
   *
   * @param cutoff Inclusive upper bound for `deleted_at`.
   * @param limit  Maximum batch size.
   */
  findExpiredSoftDeletes(cutoff: Date, limit: number): Promise<FileEntity[]>;

  /** Hard-deletes the row by id, bypassing soft-delete. */
  hardDelete(id: string): Promise<void>;

  /**
   * Marks the given files as attached to a specific surface — sets
   * `files.purpose` so the orphan-cleanup cron will not reclaim them.
   * Caller is expected to be inside a transaction (use `tx.files`).
   *
   * @param fileIds Files to update. No-op when empty.
   * @param purpose The owning surface (e.g. `TASK_RESULT`, `TASK_ATTACHMENT`).
   */
  markAsAttached(fileIds: string[], purpose: FilePurpose): Promise<void>;

  /**
   * Clears `files.purpose` (back to NULL) so the orphan-cleanup cron will
   * reclaim them after `FILES_ORPHAN_GRACE_HOURS`. Used when an attachment
   * is replaced, the parent comment/evidence is deleted, or any other
   * detach event.
   *
   * @param fileIds Files to orphan. No-op when empty.
   */
  markAsOrphaned(fileIds: string[]): Promise<void>;
}
