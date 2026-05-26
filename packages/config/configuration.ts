import { registerAs } from '@nestjs/config';

import { assertEnvSecretsValid } from './secrets/validate-env-secrets';

function collectVersionedKeys(prefix: string): Record<number, string> {
  const out: Record<number, string> = {};
  const pattern = new RegExp(`^${prefix}_v(\\d+)$`);
  for (const name of Object.keys(process.env)) {
    const match = pattern.exec(name);
    if (!match) continue;
    const value = process.env[name];
    if (typeof value === 'string' && value.length > 0) {
      out[parseInt(match[1], 10)] = value;
    }
  }
  return out;
}

export default registerAs('app', () => {
  assertEnvSecretsValid(process.env);

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') ?? ['*'],
    db: {
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'password',
      name: process.env.DB_DATABASE ?? 'marketplace',
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
      refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
      issuer: process.env.JWT_ISSUER ?? 'marketplace-api',
      audience: process.env.JWT_AUDIENCE ?? 'marketplace-clients',
      strictClaims: process.env.JWT_STRICT_CLAIMS === 'true',
    },
    security: {
      ssoTokenEncryptionKey: process.env.SSO_TOKEN_ENCRYPTION_KEY ?? '',
      ssoExchangeCodeTtlSeconds: parseInt(process.env.SSO_EXCHANGE_CODE_TTL ?? '60', 10),
      loginLockoutThreshold: parseInt(process.env.LOGIN_LOCKOUT_THRESHOLD ?? '10', 10),
      loginLockoutWindowMin: parseInt(process.env.LOGIN_LOCKOUT_WINDOW_MIN ?? '15', 10),
      throttleRedisPrefix: process.env.THROTTLE_REDIS_PREFIX ?? 'throttle:',
      publicEndpointApiKey: process.env.PUBLIC_ENDPOINT_API_KEY ?? '',
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY ?? '',
      ployosEmail: process.env.RESEND_PLOYOS_EMAIL,
      lonaEmail: process.env.RESEND_LONA_EMAIL,
    },
    payment: {
      processor: process.env.PAYMENT_PROCESSOR ?? 'polar',
      polar: {
        accessToken: process.env.POLAR_ACCESS_TOKEN,
        webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
        topUpProductId: process.env.POLAR_TOP_UP_PRODUCT_ID,
        invoiceProductId: process.env.POLAR_INVOICE_PRODUCT_ID,
        server: (process.env.POLAR_SERVER ?? 'sandbox') as 'sandbox' | 'production',
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
    internalHubUrl: process.env.INTERNAL_HUB_URL ?? 'http://localhost:3002',
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
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY ?? '',
      defaultBucket: process.env.AWS_S3_DEFAULT_BUCKET ?? '',
      presignTtlSeconds: parseInt(process.env.AWS_S3_PRESIGN_TTL_SECONDS ?? '900', 10),
      endpoint: process.env.AWS_S3_ENDPOINT ?? '',
    },
    files: {
      storageProvider: (process.env.FILES_STORAGE_PROVIDER ?? 'local') as 'local' | 's3' | 'gcs',
      maxSizeBytes: parseInt(process.env.FILES_MAX_SIZE_BYTES ?? '52428800', 10),
      allowedMimeList: process.env.FILES_ALLOWED_MIME?.split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0) ?? ['image/png', 'image/jpeg', 'application/pdf'],
      userQuotaBytes: parseInt(process.env.FILES_USER_QUOTA_BYTES ?? '524288000', 10),
      userMaxCount: parseInt(process.env.FILES_USER_MAX_COUNT ?? '1000', 10),
      purgeAfterDays: parseInt(process.env.FILES_PURGE_AFTER_DAYS ?? '30', 10),
      orphanGraceHours: parseInt(process.env.FILES_ORPHAN_GRACE_HOURS ?? '24', 10),
      maxImagePixels: process.env.FILES_MAX_IMAGE_PIXELS
        ? parseInt(process.env.FILES_MAX_IMAGE_PIXELS, 10)
        : null,
      local: {
        path: process.env.FILES_LOCAL_PATH ?? './uploads',
        publicBaseUrl: process.env.FILES_LOCAL_PUBLIC_BASE_URL ?? 'http://localhost:3000/uploads',
      },
    },
    aiKeys: {
      master: {
        currentVersion: parseInt(process.env.AI_KEYS_CURRENT_MASTER_VERSION ?? '0', 10),
        versions: collectVersionedKeys('AI_KEYS_MASTER_KEY'),
      },
      bff: {
        currentVersion: parseInt(process.env.FE_BFF_CURRENT_VERSION ?? '0', 10),
        versions: collectVersionedKeys('FE_BFF_SECRET'),
      },
    },
    identity: {
      grpcUrl: process.env.IDENTITY_GRPC_URL ?? '127.0.0.1:5001',
    },
    profiles: {
      grpcUrl: process.env.PROFILES_GRPC_URL ?? '127.0.0.1:5002',
    },
    projects: {
      grpcUrl: process.env.PROJECTS_GRPC_URL ?? '127.0.0.1:5003',
    },
    finance: {
      grpcUrl: process.env.FINANCE_GRPC_URL ?? '127.0.0.1:5004',
    },
    platform: {
      grpcUrl: process.env.PLATFORM_GRPC_URL ?? '127.0.0.1:5005',
    },
  };
});
