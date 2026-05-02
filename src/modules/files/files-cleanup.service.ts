import { EnvironmentsService } from '@common/modules/environments';
import { IStorageProvider, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { FileEntity } from '@database/entities';
import { FileStorageProvider } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

const PURGE_BATCH_SIZE = 100;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Background jobs that reclaim storage. Split across two schedules:
 *   1. `runWeeklyOrphanSweep` (Mon 03:00 UTC) → `purgeOrphanedUploads`
 *      soft-deletes uploads that were never attached (`purpose IS NULL`,
 *      no attachment row references) and are older than
 *      `FILES_ORPHAN_GRACE_HOURS`.
 *   2. `runDailySoftDeleteSweep` (daily 03:00 UTC) → `purgeExpiredSoftDeletes`
 *      physically removes the byte object and hard-deletes rows
 *      soft-deleted more than `FILES_PURGE_AFTER_DAYS` ago.
 *
 * Per-row provider routing means a file written under `local` is still
 * reclaimable after the active default switches — the row's
 * `storage_provider` column is the source of truth. Provider failures
 * never block the row hard-delete: once `deleted_at` is past the
 * cutoff, the byte object is treated as best-effort and ops sees the
 * failure in logs.
 */
@Injectable()
export class FilesCleanupService {
  private readonly logger: AppLogger;

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly activeProvider: IStorageProvider,
    private readonly uow: UnitOfWorkService,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(FilesCleanupService.name, requestContext);
  }

  // Weekly orphan sweep — runs Monday 03:00 UTC (start of the work week).
  // Files attached in the past week are protected by `purpose != NULL`;
  // the rest are eligible for soft-delete after `FILES_ORPHAN_GRACE_HOURS`.
  @Cron('0 3 * * 1')
  public async runWeeklyOrphanSweep(): Promise<void> {
    await this.purgeOrphanedUploads();
  }

  // Daily byte-reclamation — soft-deleted files past the retention window
  // have their bytes removed from storage and rows hard-deleted. Runs daily
  // because it's bound by `FILES_PURGE_AFTER_DAYS` (a per-row deadline)
  // rather than a sweep cadence.
  @Cron('0 3 * * *')
  public async runDailySoftDeleteSweep(): Promise<void> {
    await this.purgeExpiredSoftDeletes();
  }

  /**
   * Soft-deletes uploads that have outlived their grace window without ever
   * being attached. Schema-extension safety: when a NEW table starts
   * referencing `files.id` via an `*_attachments.file_id` column, add a
   * matching `LEFT JOIN ... WHERE ... IS NULL` clause to the candidate
   * query below — otherwise this sweep will incorrectly reclaim files that
   * are in active use elsewhere. Reference tables today:
   *   - task_comment_attachments
   *   - task_evidence_attachments
   */
  public async purgeOrphanedUploads(): Promise<void> {
    const cutoff = new Date(Date.now() - this.env.filesOrphanGraceHours * MS_PER_HOUR);
    this.logger.log(
      `purgeOrphanedUploads — start | cutoff: ${cutoff.toISOString()}, batchSize: ${PURGE_BATCH_SIZE}`,
    );

    let total = 0;
    try {
      for (;;) {
        const batch = await this.uow.files
          .createQueryBuilder('f')
          .leftJoin('task_comment_attachments', 'tca', 'tca.file_id = f.id')
          .leftJoin('task_evidence_attachments', 'tea', 'tea.file_id = f.id')
          .where('f.purpose IS NULL')
          .andWhere('f.deleted_at IS NULL')
          .andWhere('f.created_at < :cutoff', { cutoff })
          .andWhere('tca.id IS NULL')
          .andWhere('tea.id IS NULL')
          .orderBy('f.created_at', 'ASC')
          .take(PURGE_BATCH_SIZE)
          .getMany();
        if (batch.length === 0) break;

        const ids = batch.map((f) => f.id);
        await this.uow.files.softDelete(ids);
        total += ids.length;
      }
      this.logger.log(`purgeOrphanedUploads — complete | softDeleted: ${total}`);
    } catch (err) {
      this.logger.error(
        `purgeOrphanedUploads — failed | softDeletedSoFar: ${total}, error: ${(err as Error).message}`,
      );
    }
  }

  public async purgeExpiredSoftDeletes(): Promise<void> {
    const cutoff = new Date(Date.now() - this.env.filesPurgeAfterDays * MS_PER_DAY);
    this.logger.log(
      `purgeExpiredSoftDeletes — start | cutoff: ${cutoff.toISOString()}, batchSize: ${PURGE_BATCH_SIZE}`,
    );

    let total = 0;
    try {
      for (;;) {
        const batch = await this.uow.files.findExpiredSoftDeletes(cutoff, PURGE_BATCH_SIZE);
        if (batch.length === 0) break;

        for (const file of batch) {
          await this.purgeOne(file);
          total++;
        }
      }
      this.logger.log(`purgeExpiredSoftDeletes — complete | purged: ${total}`);
    } catch (err) {
      // Never let an exception escape — the scheduler would otherwise
      // crash. Log and exit; the next scheduled run will retry.
      this.logger.error(
        `purgeExpiredSoftDeletes — failed | purgedSoFar: ${total}, error: ${(err as Error).message}`,
      );
    }
  }

  private async purgeOne(file: FileEntity): Promise<void> {
    const provider = this.providerForRow(file);
    if (provider) {
      try {
        await provider.remove(file.storageKey);
      } catch (err) {
        // Bytes may already be gone, or the backend may be transiently
        // unavailable. Either way, log and proceed — leaving the row
        // dangling forever would never reclaim space.
        this.logger.error(
          `purgeOne — provider remove failed | id: ${file.id}, provider: ${file.storageProvider}, error: ${(err as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        `purgeOne — no provider for row, skipping byte cleanup | id: ${file.id}, provider: ${file.storageProvider}`,
      );
    }
    await this.uow.files.hardDelete(file.id);
  }

  /**
   * Returns the storage provider matching the row's `storage_provider`
   * column. Currently only the active provider is reachable; rows authored
   * under a different provider fall through to a `null` return so the
   * cron logs them as skipped byte-cleanups but still hard-deletes the row.
   */
  private providerForRow(file: FileEntity): IStorageProvider | null {
    if (file.storageProvider === this.activeProvider.name) {
      return this.activeProvider;
    }
    if (file.storageProvider === FileStorageProvider.LOCAL) {
      return this.activeProvider.name === FileStorageProvider.LOCAL ? this.activeProvider : null;
    }
    return null;
  }
}
