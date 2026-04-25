import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files-cleanup.service';

/**
 * FilesModule — domain-level files feature.
 *
 * Owns the `FileEntity` row lifecycle: ownership, quota enforcement,
 * sha256, soft delete, and the daily 03:00 purge cron. Storage primitives
 * (write/get/remove bytes) are delegated to `FileStorageModule` via the
 * globally-bound `STORAGE_PROVIDER` token.
 *
 * Other feature modules (profile avatar, project attachments) inject
 * `FilesService` to manage tracked file rows. Features that need to
 * upload bytes without a tracked row should depend on
 * `STORAGE_PROVIDER` + `FileContentValidator` from the common module
 * directly.
 */
@Module({
  imports: [UnitOfWorkModule],
  controllers: [FilesController],
  providers: [FilesService, FilesCleanupService],
  exports: [FilesService],
})
export class FilesModule {}
