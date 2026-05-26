import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { STORAGE_PROVIDER } from './constants';
import { IStorageProvider } from './interfaces';
import { LocalStorageProvider, S3StorageProvider } from './providers';
import { UrlResolverService } from './services/url-resolver.service';
import { FileContentValidator } from './validators';

/**
 * FileStorageModule — pure storage abstraction.
 *
 * Provides the means to **resolve** files (write bytes, hand back a URL,
 * remove bytes) behind a Strategy + Adapter + Factory triad. It owns no
 * database, no HTTP surface, and no business rules — feature modules
 * (e.g. `src/modules/files/`) compose it with their own entities and
 * domain logic.
 *
 * The active provider is bound at boot via `useFactory` to the
 * `STORAGE_PROVIDER` DI token. Today: `local` and `s3`; `gcs` reserved.
 *
 * Public surface (consumed by feature modules and other features that
 * upload files independently — profile avatars, project attachments, …):
 *
 *   - DI token   `STORAGE_PROVIDER`     → `IStorageProvider`
 *   - Validator  `FileContentValidator` → magic-byte sniff + sanitised `IUploadInput`
 *
 * `@Global()` so consumers can inject without re-importing.
 */
@Global()
@Module({
  providers: [
    FileContentValidator,
    LocalStorageProvider,
    S3StorageProvider,
    UrlResolverService,
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
  ],
  exports: [STORAGE_PROVIDER, FileContentValidator, UrlResolverService],
})
export class FileStorageModule {}
