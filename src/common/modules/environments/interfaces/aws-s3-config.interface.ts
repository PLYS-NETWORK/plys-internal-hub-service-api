export interface IAwsS3Config {
  /** AWS region the S3 client will target (e.g. `us-east-1`). */
  readonly awsS3Region: string;

  /**
   * Static access key. When empty, the SDK resolves credentials via its
   * default chain (IAM role, instance profile, AWS_ACCESS_KEY_ID env, etc.).
   */
  readonly awsS3AccessKeyId: string;

  /** Static secret key paired with `awsS3AccessKeyId`. Empty when using the chain. */
  readonly awsS3SecretAccessKey: string;

  /** Default bucket used by callers that don't specify one (e.g. files module). */
  readonly awsS3DefaultBucket: string;

  /** Default TTL (seconds) for presigned GET URLs handed back to clients. */
  readonly awsS3PresignTtlSeconds: number;

  /**
   * Custom S3-compatible endpoint URL (e.g. Hetzner, MinIO, Cloudflare R2).
   * Empty string = use the AWS default endpoint for the configured region.
   */
  readonly awsS3Endpoint: string;
}
