import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { IAwsS3ClientService, IPresignParams, IPutObjectParams, IRemoveParams } from './interfaces';

/**
 * Reusable AWS S3 client wrapper. The SDK client is constructed lazily on
 * first `getClient()` call so an unused module never fails boot when its
 * env is incomplete (e.g. running with `FILES_STORAGE_PROVIDER=local`).
 *
 * Static credentials are forwarded when `AWS_S3_ACCESS_KEY_ID` is set;
 * otherwise the SDK's default credential chain is used (IAM role,
 * instance profile, environment) — preferred for EC2/ECS/EKS deploys.
 */
@Injectable()
export class AwsS3ClientService implements IAwsS3ClientService {
  private readonly logger: AppLogger;
  private client: S3Client | null = null;

  constructor(
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AwsS3ClientService.name, requestContext);
  }

  /** @inheritdoc */
  public getClient(): S3Client {
    if (this.client) return this.client;

    const region = this.env.awsS3Region;
    if (!region) {
      this.logger.error(`getClient — AWS_S3_REGION is not configured`);
      throw new TranslatableException({
        messageKey: 'error.file.storage_error',
        errorCode: ERROR_CODES.FILE_STORAGE_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    const accessKeyId = this.env.awsS3AccessKeyId;
    const secretAccessKey = this.env.awsS3SecretAccessKey;
    // Forward static credentials only when both halves are present; an
    // empty access key means the caller wants the default credential chain.
    const credentials =
      accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;

    const rawEndpoint = this.env.awsS3Endpoint;
    const endpoint = rawEndpoint
      ? rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')
        ? rawEndpoint
        : `https://${rawEndpoint}`
      : undefined;

    this.client = new S3Client({
      region,
      credentials,
      endpoint,
      forcePathStyle: !!endpoint,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.logger.log(
      `getClient — initialised | region: ${region}, credentialMode: ${credentials ? 'static' : 'default-chain'}${endpoint ? `, endpoint: ${endpoint}` : ''}, is connected: ${this.client ? 'yes' : 'no'}`,
    );
    return this.client;
  }

  /** @inheritdoc */
  public async putObject(params: IPutObjectParams): Promise<void> {
    const Bucket = this.resolveBucket(params.bucket);
    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `putObject — failed | bucket: ${Bucket}, key: ${params.key}, error: ${msg}`,
      );
      throw new TranslatableException({
        messageKey: 'error.file.storage_error',
        errorCode: ERROR_CODES.FILE_STORAGE_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  /** @inheritdoc */
  public async presignGetUrl(params: IPresignParams): Promise<string> {
    const Bucket = this.resolveBucket(params.bucket);
    const ttl = params.ttlSec ?? this.env.awsS3PresignTtlSeconds;
    try {
      return await getSignedUrl(
        this.getClient(),
        new GetObjectCommand({ Bucket, Key: params.key }),
        { expiresIn: ttl },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `presignGetUrl — failed | bucket: ${Bucket}, key: ${params.key}, error: ${msg}`,
      );
      throw new TranslatableException({
        messageKey: 'error.file.storage_error',
        errorCode: ERROR_CODES.FILE_STORAGE_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  /** @inheritdoc */
  public async removeObject(params: IRemoveParams): Promise<void> {
    const Bucket = this.resolveBucket(params.bucket);
    try {
      await this.getClient().send(new DeleteObjectCommand({ Bucket, Key: params.key }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `removeObject — failed | bucket: ${Bucket}, key: ${params.key}, error: ${msg}`,
      );
      throw new TranslatableException({
        messageKey: 'error.file.storage_error',
        errorCode: ERROR_CODES.FILE_STORAGE_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  /** @inheritdoc */
  public async checkConnectivity(bucket?: string): Promise<void> {
    const Bucket = this.resolveBucket(bucket);
    this.logger.log(`checkConnectivity — start | bucket: ${Bucket}`);
    try {
      await this.getClient().send(new HeadBucketCommand({ Bucket }));
      this.logger.log(`checkConnectivity — complete | bucket: ${Bucket}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`checkConnectivity — failed | bucket: ${Bucket}, error: ${msg}`);
      // Rethrow the raw SDK error so callers (e.g. startup health checks) see
      // the actual failure reason rather than a generic TranslatableException.
      throw err;
    }
  }

  private resolveBucket(override?: string): string {
    const bucket = override && override.length > 0 ? override : this.env.awsS3DefaultBucket;
    if (!bucket) {
      this.logger.error(`resolveBucket — no bucket configured`);
      throw new TranslatableException({
        messageKey: 'error.file.storage_error',
        errorCode: ERROR_CODES.FILE_STORAGE_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
    return bucket;
  }
}
