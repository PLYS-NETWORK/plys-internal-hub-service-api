import { EnvironmentsService } from '@common/modules/environments';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Global, Module } from '@nestjs/common';

import { STORAGE_PROVIDER } from './constants';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesCleanupService } from './files-cleanup.service';
import { IStorageProvider } from './interfaces';
import { LocalStorageProvider } from './providers';
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
 * Adding S3 / GCS later is purely additive (see plan §3.3):
 *   1. Drop `s3-storage.provider.ts` / `gcs-storage.provider.ts` under
 *      `providers/` (each implementing `IStorageProvider`).
 *   2. Add the concrete class to `providers` and to the factory's
 *      `inject` list.
 *   3. Replace the corresponding `throw` line below with `return s3;`
 *      / `return gcs;`.
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
    {
      provide: STORAGE_PROVIDER,
      inject: [EnvironmentsService, LocalStorageProvider],
      useFactory: (env: EnvironmentsService, local: LocalStorageProvider): IStorageProvider => {
        switch (env.filesStorageProvider) {
          case 'local':
            return local;
          case 's3':
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
