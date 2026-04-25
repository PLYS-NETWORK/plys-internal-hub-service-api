import type { S3Client } from '@aws-sdk/client-s3';

export interface IPutObjectParams {
  /** Target bucket. Pass `null` / omit to use `AWS_S3_DEFAULT_BUCKET`. */
  readonly bucket?: string;
  /** Object key (provider-relative path). */
  readonly key: string;
  /** Bytes to upload. */
  readonly body: Buffer;
  /** Content-Type stamped on the object. */
  readonly contentType: string;
}

export interface IPresignParams {
  readonly bucket?: string;
  readonly key: string;
  /** TTL override in seconds; falls back to `AWS_S3_PRESIGN_TTL_SECONDS`. */
  readonly ttlSec?: number;
}

export interface IRemoveParams {
  readonly bucket?: string;
  readonly key: string;
}

/**
 * Reusable wrapper around the AWS S3 SDK. Lazily constructs the underlying
 * `S3Client` on first use so an unused module never fails boot when its
 * env is incomplete (e.g. running with `FILES_STORAGE_PROVIDER=local`).
 *
 * Any feature that needs to talk to S3 — files module today, log archiving
 * or exports tomorrow — should depend on this service rather than touching
 * the SDK directly.
 */
export interface IAwsS3ClientService {
  /**
   * Returns the lazily-initialised `S3Client`. Validates that `AWS_S3_REGION`
   * is set on first call; static credentials are forwarded when present and
   * otherwise the SDK's default credential chain takes over.
   *
   * @throws TranslatableException(FILE_STORAGE_ERROR) when required env is missing.
   */
  getClient(): S3Client;

  /**
   * Uploads `body` to `bucket/key`. Throws on backend failure with the
   * unified file-storage error code.
   *
   * @throws TranslatableException(FILE_STORAGE_ERROR) on SDK rejection.
   */
  putObject(params: IPutObjectParams): Promise<void>;

  /**
   * Returns a presigned GET URL valid for `ttlSec` seconds (or the default).
   *
   * @throws TranslatableException(FILE_STORAGE_ERROR) when presigning fails.
   */
  presignGetUrl(params: IPresignParams): Promise<string>;

  /**
   * Deletes the object. Idempotent — if the object is already gone the
   * call MUST resolve cleanly (S3 itself returns success for missing keys).
   *
   * @throws TranslatableException(FILE_STORAGE_ERROR) on unrecoverable failure.
   */
  removeObject(params: IRemoveParams): Promise<void>;
}
