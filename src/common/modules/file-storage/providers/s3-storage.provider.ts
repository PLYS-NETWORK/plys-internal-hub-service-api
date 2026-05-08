import { AwsS3ClientService } from '@common/modules/aws-s3';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { FileStorageProvider } from '@database/enums';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { IDownloadHandle, IStorageProvider, IStoredObject, IUploadInput } from '../interfaces';

// Presigned URL TTL for one-shot download redirects. Kept short — the URL
// is consumed immediately by the browser following the 302, so a wide
// window only widens the leak surface if the URL is captured in transit.
const DOWNLOAD_REDIRECT_TTL_SECONDS = 60;

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
export class S3StorageProvider implements IStorageProvider, OnApplicationBootstrap {
  public readonly name = FileStorageProvider.S3;

  private readonly logger: AppLogger;

  constructor(
    private readonly s3: AwsS3ClientService,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(S3StorageProvider.name, requestContext);
  }

  /** @inheritdoc */
  public async put(input: IUploadInput, keyHint: string): Promise<IStoredObject> {
    const key = this.buildKey(keyHint);
    this.logger.log(`put — start | key: ${key}, size: ${input.size}`);
    await this.s3.putObject({
      key,
      body: input.buffer,
      contentType: input.mimeType,
    });
    const url = await this.s3.presignGetUrl({ key });
    this.logger.log(`put — complete | key: ${key}`);
    return { key, url };
  }

  /** @inheritdoc */
  public async getUrl(key: string, ttlSec?: number): Promise<string> {
    return this.s3.presignGetUrl({ key, ttlSec });
  }

  /** @inheritdoc */
  public async download(key: string): Promise<IDownloadHandle> {
    const url = await this.s3.presignGetUrl({ key, ttlSec: DOWNLOAD_REDIRECT_TTL_SECONDS });
    return { kind: 'redirect', url };
  }

  /** @inheritdoc */
  public async remove(key: string): Promise<void> {
    this.logger.log(`remove — start | key: ${key}`);
    await this.s3.removeObject({ key });
    this.logger.log(`remove — complete | key: ${key}`);
  }

  public async onApplicationBootstrap(): Promise<void> {
    try {
      await this.s3.checkConnectivity();
    } catch (err) {
      // Log as error but do NOT crash — a transient network hiccup or
      // misconfigured endpoint should not block the entire app from booting.
      // The real failure will surface on the first actual S3 operation.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`onApplicationBootstrap — S3 connectivity check failed | error: ${msg}`);
    }
  }

  // Prefixes key with the current environment so objects are isolated per env
  // inside a shared bucket: e.g. production/2026/04/<uuid>.png
  private buildKey(keyHint: string): string {
    return `${this.env.nodeEnv}/${keyHint}`;
  }
}
