import { Global, Module } from '@nestjs/common';

import { AwsS3ClientService } from './aws-s3-client.service';

/**
 * Reusable AWS S3 wrapper. `@Global()` so any feature module can inject
 * `AwsS3ClientService` without re-importing this module — the files
 * module's S3 storage provider, log archiving, exports, etc.
 *
 * The SDK client itself is constructed lazily inside `AwsS3ClientService`
 * on first use, so an unused S3 module never fails boot when its env is
 * incomplete.
 */
@Global()
@Module({
  providers: [AwsS3ClientService],
  exports: [AwsS3ClientService],
})
export class AwsS3Module {}
