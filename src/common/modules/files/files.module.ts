import { EnvironmentsService } from '@common/modules/environments';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Global, Module } from '@nestjs/common';

import { STORAGE_PROVIDER } from './constants';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files-cleanup.service';
import { IStorageProvider } from './interfaces';
import { LocalStorageProvider, S3StorageProvider } from './providers';
import { FileContentValidator } from './validators';

/**
 * FilesModule — Strategy + Adapter + Factory wiring.
 *
 * The active storage provider is selected once at boot by reading
 * `EnvironmentsService.filesStorageProvider` and bound to the
 * `STORAGE_PROVIDER` DI token. `FilesService` and `FilesCleanupService`
 * reference the provider only through this token — they never import a
 * concrete implementation.
 *
 * Currently wired: `local` (filesystem) and `s3` (AWS via AwsS3Module).
 * `gcs` is reserved; adding it is purely additive — drop a provider
 * under `providers/`, add it to `providers` + the factory's `inject`,
 * and replace the `throw` line with `return gcs;`.
 *
 * No edits to `FilesService`, `FilesController`, or any caller.
 */
@Global()
@Module({
  imports: [UnitOfWorkModule],
  controllers: [FilesController],
  providers: [
    FileContentValidator,
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [EnvironmentsService, LocalStorageProvider, S3StorageProvider],
      useFactory: (
        env: EnvironmentsService,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
      ): IStorageProvider => {
        switch (env.filesStorageProvider) {
          case 'local':
            return local;
          case 's3':
            return s3;
          case 'gcs':
            throw new Error(
              `FILES_STORAGE_PROVIDER='${env.filesStorageProvider}' is not implemented in this build`,
            );
        }
      },
    },
    FilesService,
    FilesCleanupService,
  ],
  exports: [FilesService, FileContentValidator],
})
export class FilesModule {}
