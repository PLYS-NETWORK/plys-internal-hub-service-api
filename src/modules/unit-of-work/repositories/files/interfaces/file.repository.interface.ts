import { AbstractRepository } from '@common/repositories';
import { FileEntity } from '@database/entities';

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
}
