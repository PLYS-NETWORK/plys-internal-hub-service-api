import { Injectable, OnModuleInit } from '@nestjs/common';
import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import { assertEnvSecretsValid } from '@plys/libraries/config/secrets/validate-env-secrets';
import { config as loadDotenv } from 'dotenv';

import {
  getAiKeysBff,
  getAiKeysMaster,
  getAllowedOrigins,
  getAwsS3Endpoint,
  getCorsAllowLocalhost,
  getDeployEnv,
  getFilesAllowedMimeList,
  getFilesMaxImagePixels,
  getFilesStorageProvider,
  getGoogleCallbackUrl,
  getGoogleClientId,
  getGoogleClientSecret,
  getJwtStrictClaims,
  getPolarServer,
  getRedisPassword,
  optionalEnv,
  parseBoolEnv,
  parseIntEnv,
  resolveGrpcUrl,
} from './env.util';
import {
  FilesStorageProviderName,
  IAiKeysVersionedSecrets,
  IEnvironmentsService,
} from './interfaces';

@Injectable()
export class EnvironmentsService implements IEnvironmentsService, OnModuleInit {
  public onModuleInit(): void {
    loadDotenv({ path: resolveEnvFilePath() });
    assertEnvSecretsValid(process.env);
  }

  public get port(): number {
    return parseIntEnv('PORT', 3000);
  }

  public get nodeEnv(): string {
    return optionalEnv('NODE_ENV', 'development');
  }

  public get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  public get isLocal(): boolean {
    return this.nodeEnv === 'local';
  }

  public get allowedOrigins(): string[] {
    return getAllowedOrigins();
  }

  public get corsAllowLocalhost(): boolean {
    return getCorsAllowLocalhost();
  }

  public get dbHost(): string {
    return optionalEnv('DB_HOST', 'localhost');
  }

  public get dbPort(): number {
    return parseIntEnv('DB_PORT', 5432);
  }

  public get dbUsername(): string {
    return optionalEnv('DB_USERNAME', 'postgres');
  }

  public get dbPassword(): string {
    return optionalEnv('DB_PASSWORD', 'password');
  }

  public get dbName(): string {
    return optionalEnv('DB_DATABASE', 'marketplace');
  }

  public get jwtAccessSecret(): string {
    return optionalEnv('JWT_ACCESS_SECRET', '');
  }

  public get jwtAccessExpiration(): string {
    return optionalEnv('JWT_ACCESS_EXPIRATION', '15m');
  }

  public get jwtRefreshSecret(): string {
    return optionalEnv('JWT_REFRESH_SECRET', '');
  }

  public get jwtRefreshExpiration(): string {
    return optionalEnv('JWT_REFRESH_EXPIRATION', '7d');
  }

  public get jwtIssuer(): string {
    return optionalEnv('JWT_ISSUER', 'marketplace-api');
  }

  public get jwtAudience(): string {
    return optionalEnv('JWT_AUDIENCE', 'marketplace-clients');
  }

  public get jwtStrictClaims(): boolean {
    return getJwtStrictClaims();
  }

  public get ssoTokenEncryptionKey(): string {
    return optionalEnv('SSO_TOKEN_ENCRYPTION_KEY', '');
  }

  public get ssoExchangeCodeTtlSeconds(): number {
    return parseIntEnv('SSO_EXCHANGE_CODE_TTL', 60);
  }

  public get loginLockoutThreshold(): number {
    return parseIntEnv('LOGIN_LOCKOUT_THRESHOLD', 10);
  }

  public get loginLockoutWindowMin(): number {
    return parseIntEnv('LOGIN_LOCKOUT_WINDOW_MIN', 15);
  }

  public get throttleRedisPrefix(): string {
    return optionalEnv('THROTTLE_REDIS_PREFIX', 'throttle:');
  }

  public get publicEndpointApiKey(): string {
    return optionalEnv('PUBLIC_ENDPOINT_API_KEY', '');
  }

  public get grpcServiceSecret(): string {
    return optionalEnv('GRPC_SERVICE_SECRET', '');
  }

  public get resendApiKey(): string {
    return optionalEnv('RESEND_API_KEY', '');
  }

  public get resendPloyosEmail(): string {
    return optionalEnv('RESEND_PLOYOS_EMAIL', '');
  }

  public get resendLonaosEmail(): string {
    return optionalEnv('RESEND_LONAOS_EMAIL', '');
  }

  public get paymentProcessor(): string {
    return optionalEnv('PAYMENT_PROCESSOR', 'polar');
  }

  public get polarAccessToken(): string {
    return optionalEnv('POLAR_ACCESS_TOKEN', '');
  }

  public get polarServer(): 'sandbox' | 'production' {
    return getPolarServer();
  }

  public get polarWebhookSecret(): string {
    return optionalEnv('POLAR_WEBHOOK_SECRET', '');
  }

  public get polarTopUpProductId(): string {
    return optionalEnv('POLAR_TOP_UP_PRODUCT_ID', '');
  }

  public get polarInvoiceProductId(): string {
    return optionalEnv('POLAR_INVOICE_PRODUCT_ID', '');
  }

  public get stripeSecretKey(): string {
    return optionalEnv('STRIPE_SECRET_KEY', '');
  }

  public get stripeWebhookSecret(): string {
    return optionalEnv('STRIPE_WEBHOOK_SECRET', '');
  }

  public get stripeConnectClientId(): string {
    return optionalEnv('STRIPE_CONNECT_CLIENT_ID', '');
  }

  public get googleClientId(): string | undefined {
    return getGoogleClientId();
  }

  public get googleClientSecret(): string | undefined {
    return getGoogleClientSecret();
  }

  public get googleCallbackUrl(): string | undefined {
    return getGoogleCallbackUrl();
  }

  public get isGoogleOAuthConfigured(): boolean {
    return !!(this.googleClientId && this.googleClientSecret && this.googleCallbackUrl);
  }

  public get ployosUrl(): string {
    return optionalEnv('PLOYOS_URL', 'http://localhost:3000');
  }

  public get lonaosUrl(): string {
    return optionalEnv('LONAOS_URL', 'http://localhost:3001');
  }

  public get internalHubUrl(): string {
    return optionalEnv('INTERNAL_HUB_URL', 'http://localhost:3002');
  }

  public get redisHost(): string {
    return optionalEnv('REDIS_HOST', 'localhost');
  }

  public get redisPort(): number {
    return parseIntEnv('REDIS_PORT', 6379);
  }

  public get redisPassword(): string | undefined {
    return getRedisPassword();
  }

  public get redisDb(): number {
    return parseIntEnv('REDIS_DB', 0);
  }

  public get redisKeyPrefix(): string {
    return optionalEnv('REDIS_KEY_PREFIX', 'app:');
  }

  public get redisTlsEnabled(): boolean {
    return parseBoolEnv('REDIS_TLS_ENABLED', false);
  }

  public get wsMaxConnectionsPerUser(): number {
    return parseIntEnv('WS_MAX_CONNECTIONS_PER_USER', 10);
  }

  public get wsConnectRateLimitPerMinute(): number {
    return parseIntEnv('WS_CONNECT_RATE_LIMIT', 30);
  }

  public get copyleaksApiKey(): string {
    return optionalEnv('COPYLEAKS_API_KEY', '');
  }

  public get filesStorageProvider(): FilesStorageProviderName {
    return getFilesStorageProvider();
  }

  public get filesMaxSizeBytes(): number {
    return parseIntEnv('FILES_MAX_SIZE_BYTES', 52_428_800);
  }

  public get filesAllowedMimeList(): string[] {
    return getFilesAllowedMimeList();
  }

  public get filesUserQuotaBytes(): number {
    return parseIntEnv('FILES_USER_QUOTA_BYTES', 524_288_000);
  }

  public get filesUserMaxCount(): number {
    return parseIntEnv('FILES_USER_MAX_COUNT', 1000);
  }

  public get filesPurgeAfterDays(): number {
    return parseIntEnv('FILES_PURGE_AFTER_DAYS', 30);
  }

  public get filesOrphanGraceHours(): number {
    return parseIntEnv('FILES_ORPHAN_GRACE_HOURS', 24);
  }

  public get filesMaxImagePixels(): number | null {
    return getFilesMaxImagePixels();
  }

  public get filesLocalPath(): string {
    return optionalEnv('FILES_LOCAL_PATH', './uploads');
  }

  public get filesLocalPublicBaseUrl(): string {
    return optionalEnv('FILES_LOCAL_PUBLIC_BASE_URL', 'http://localhost:3000/uploads');
  }

  public get awsS3Region(): string {
    return optionalEnv('AWS_S3_REGION', '');
  }

  public get awsS3AccessKeyId(): string {
    return optionalEnv('AWS_S3_ACCESS_KEY_ID', '');
  }

  public get awsS3SecretAccessKey(): string {
    return optionalEnv('AWS_S3_SECRET_ACCESS_KEY', '');
  }

  public get awsS3DefaultBucket(): string {
    return optionalEnv('AWS_S3_DEFAULT_BUCKET', '');
  }

  public get awsS3PresignTtlSeconds(): number {
    return parseIntEnv('AWS_S3_PRESIGN_TTL_SECONDS', 900);
  }

  public get awsS3Endpoint(): string {
    return getAwsS3Endpoint();
  }

  public get aiKeysMaster(): IAiKeysVersionedSecrets {
    return getAiKeysMaster();
  }

  public get aiKeysBff(): IAiKeysVersionedSecrets {
    return getAiKeysBff();
  }

  public get identityServiceGrpcUrl(): string {
    return resolveGrpcUrl(process.env.IDENTITY_GRPC_URL, process.env.IDENTITY_GRPC_PORT, '5001');
  }

  public get businessServiceGrpcUrl(): string {
    return resolveGrpcUrl(process.env.BUSINESS_GRPC_URL, process.env.BUSINESS_GRPC_PORT, '5002');
  }

  public get consultantServiceGrpcUrl(): string {
    return resolveGrpcUrl(
      process.env.CONSULTANT_GRPC_URL,
      process.env.CONSULTANT_GRPC_PORT,
      '5003',
    );
  }

  public get internalAdminServiceGrpcUrl(): string {
    return resolveGrpcUrl(
      process.env.INTERNAL_ADMIN_GRPC_URL,
      process.env.INTERNAL_ADMIN_GRPC_PORT,
      '5004',
    );
  }

  public get internalTaskReviewerServiceGrpcUrl(): string {
    return resolveGrpcUrl(
      process.env.INTERNAL_TASK_REVIEWER_GRPC_URL,
      process.env.INTERNAL_TASK_REVIEWER_GRPC_PORT,
      '5005',
    );
  }

  public get financeServiceGrpcUrl(): string {
    return resolveGrpcUrl(process.env.FINANCE_GRPC_URL, process.env.FINANCE_GRPC_PORT, '5006');
  }

  public get notificationsServiceGrpcUrl(): string {
    return resolveGrpcUrl(
      process.env.NOTIFICATIONS_GRPC_URL,
      process.env.NOTIFICATIONS_GRPC_PORT,
      '5007',
    );
  }

  public get platformServiceGrpcUrl(): string {
    return resolveGrpcUrl(process.env.PLATFORM_GRPC_URL, process.env.PLATFORM_GRPC_PORT, '5008');
  }

  public get aiProviderServiceGrpcUrl(): string {
    return resolveGrpcUrl(
      process.env.AI_PROVIDER_GRPC_URL,
      process.env.AI_PROVIDER_GRPC_PORT,
      '5009',
    );
  }

  /** @deprecated Use businessServiceGrpcUrl — removed after profiles-service decommission */
  public get profilesServiceGrpcUrl(): string {
    return this.businessServiceGrpcUrl;
  }

  /** @deprecated Use businessServiceGrpcUrl or consultantServiceGrpcUrl */
  public get projectsServiceGrpcUrl(): string {
    return this.businessServiceGrpcUrl;
  }

  public get deployEnv(): string {
    return getDeployEnv();
  }
}
