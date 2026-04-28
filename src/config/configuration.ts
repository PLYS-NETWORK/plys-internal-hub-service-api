import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') ?? ['*'],
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    name: process.env.DB_NAME ?? 'marketplace',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
    issuer: process.env.JWT_ISSUER ?? 'marketplace-api',
    audience: process.env.JWT_AUDIENCE ?? 'marketplace-clients',
    // Roll-forward toggle: when false, tokens missing iss/aud are still
    // accepted so a deploy can land before all live tokens carry the new
    // claims. Flip to `true` after one access-token TTL has elapsed.
    strictClaims: process.env.JWT_STRICT_CLAIMS === 'true',
  },
  security: {
    // Base64-encoded 32-byte AES-256 key. Required in production; absence
    // throws at boot. In dev a deterministic test key is allowed.
    ssoTokenEncryptionKey: process.env.SSO_TOKEN_ENCRYPTION_KEY ?? '',
    // Single-use code lifetime for /auth/sso/exchange (seconds).
    ssoExchangeCodeTtlSeconds: parseInt(process.env.SSO_EXCHANGE_CODE_TTL ?? '60', 10),
    // Account lockout knobs (per user). After N failed attempts within the
    // window the user is locked until the window expires.
    loginLockoutThreshold: parseInt(process.env.LOGIN_LOCKOUT_THRESHOLD ?? '10', 10),
    loginLockoutWindowMin: parseInt(process.env.LOGIN_LOCKOUT_WINDOW_MIN ?? '15', 10),
    // Used to namespace throttler keys across environments / shared Redis.
    throttleRedisPrefix: process.env.THROTTLE_REDIS_PREFIX ?? 'throttle:',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    ployosEmail: process.env.RESEND_PLOYOS_EMAIL,
    lonaEmail: process.env.RESEND_LONA_EMAIL,
  },
  payment: {
    // Default to Polar.sh. Set PAYMENT_PROCESSOR=stripe to switch providers.
    processor: process.env.PAYMENT_PROCESSOR ?? 'polar',
    polar: {
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
      topUpProductId: process.env.POLAR_TOP_UP_PRODUCT_ID,
      invoiceProductId: process.env.POLAR_INVOICE_PRODUCT_ID,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID ?? '',
    },
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/sso/google/callback',
  },
  ployosUrl: process.env.PLOYOS_URL ?? 'http://localhost:3000',
  lonaUrl: process.env.LONA_URL ?? 'http://localhost:3001',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'app:',
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true',
  },
  copyleaks: {
    apiKey: process.env.COPYLEAKS_API_KEY ?? '',
  },
  awsS3: {
    region: process.env.AWS_S3_REGION ?? '',
    // Empty access key means "fall back to the SDK's default credential chain"
    // (IAM role, instance profile, env vars). Treated as an opt-out signal,
    // not a misconfiguration.
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY ?? '',
    defaultBucket: process.env.AWS_S3_DEFAULT_BUCKET ?? '',
    presignTtlSeconds: parseInt(process.env.AWS_S3_PRESIGN_TTL_SECONDS ?? '900', 10),
    // Custom S3-compatible endpoint for non-AWS providers (Hetzner, MinIO, R2).
    // Empty string tells the SDK to use the AWS default endpoint.
    endpoint: process.env.AWS_S3_ENDPOINT ?? '',
  },
  files: {
    // Pluggable storage backend. `local` and `s3` are wired; `gcs` is reserved.
    storageProvider: (process.env.FILES_STORAGE_PROVIDER ?? 'local') as 'local' | 's3' | 'gcs',
    maxSizeBytes: parseInt(process.env.FILES_MAX_SIZE_BYTES ?? '10485760', 10),
    allowedMimeList: process.env.FILES_ALLOWED_MIME?.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0) ?? ['image/png', 'image/jpeg', 'application/pdf'],
    userQuotaBytes: parseInt(process.env.FILES_USER_QUOTA_BYTES ?? '524288000', 10),
    userMaxCount: parseInt(process.env.FILES_USER_MAX_COUNT ?? '1000', 10),
    purgeAfterDays: parseInt(process.env.FILES_PURGE_AFTER_DAYS ?? '30', 10),
    // Optional per-image pixel cap (W*H). Blank disables.
    maxImagePixels: process.env.FILES_MAX_IMAGE_PIXELS
      ? parseInt(process.env.FILES_MAX_IMAGE_PIXELS, 10)
      : null,
    local: {
      path: process.env.FILES_LOCAL_PATH ?? './uploads',
      publicBaseUrl: process.env.FILES_LOCAL_PUBLIC_BASE_URL ?? 'http://localhost:3000/uploads',
    },
  },
}));
