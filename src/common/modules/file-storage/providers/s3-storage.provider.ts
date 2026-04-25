import { AwsS3ClientService } from '@common/modules/aws-s3';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { FileStorageProvider } from '@database/enums';
import { Injectable } from '@nestjs/common';

import { IStorageProvider, IStoredObject, IUploadInput } from '../interfaces';

/**
 * Adapter that maps the unified `IStorageProvider` contract onto the
 * reusable `AwsS3ClientService`. The S3 SDK rejects path-traversal at the
 * key level (no filesystem semantics), so the provider does not duplicate
 * the local provider's symlink/realpath defenses; key safety is handled
 * upstream in `FilesService` (server-generated UUID keys).
 *
 * Bucket is the configured `AWS_S3_DEFAULT_BUCKET`. URLs are short-lived
 * presigned GET URLs valid for `AWS_S3_PRESIGN_TTL_SECONDS` by default.
 */
@Injectable()
export class S3StorageProvider implements IStorageProvider {
  public readonly name = FileStorageProvider.S3;

  private readonly logger: AppLogger;

  constructor(
    private readonly s3: AwsS3ClientService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(S3StorageProvider.name, requestContext);
  }

  /** @inheritdoc */
  public async put(input: IUploadInput, keyHint: string): Promise<IStoredObject> {
    this.logger.log(`put — start | key: ${keyHint}, size: ${input.size}`);
    await this.s3.putObject({
      key: keyHint,
      body: input.buffer,
      contentType: input.mimeType,
    });
    const url = await this.s3.presignGetUrl({ key: keyHint });
    this.logger.log(`put — complete | key: ${keyHint}`);
    return { key: keyHint, url };
  }

  /** @inheritdoc */
  public async getUrl(key: string, ttlSec?: number): Promise<string> {
    return this.s3.presignGetUrl({ key, ttlSec });
  }

  /** @inheritdoc */
  public async remove(key: string): Promise<void> {
    this.logger.log(`remove — start | key: ${key}`);
    await this.s3.removeObject({ key });
    this.logger.log(`remove — complete | key: ${key}`);
  }
}
