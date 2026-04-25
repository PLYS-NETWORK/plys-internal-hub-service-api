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

/**
 * Daily background job that reclaims storage from rows soft-deleted more
 * than `FILES_PURGE_AFTER_DAYS` ago. Runs at 03:00 UTC by default.
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

  @Cron('0 3 * * *')
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
