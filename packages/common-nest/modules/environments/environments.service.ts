import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  FilesStorageProviderName,
  IAiKeysVersionedSecrets,
  IEnvironmentsService,
} from './interfaces';

@Injectable()
export class EnvironmentsService implements IEnvironmentsService {
  constructor(private readonly configService: ConfigService) {}

  public get port(): number {
    return this.configService.getOrThrow<number>('app.port');
  }

  public get nodeEnv(): string {
    return this.configService.getOrThrow<string>('app.nodeEnv');
  }

  public get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  public get isLocal(): boolean {
    return this.nodeEnv === 'local';
  }

  public get allowedOrigins(): string[] {
    return this.configService.getOrThrow<string[]>('app.allowedOrigins');
  }

  public get dbHost(): string {
    return this.configService.getOrThrow<string>('app.db.host');
  }

  public get dbPort(): number {
    return this.configService.getOrThrow<number>('app.db.port');
  }

  public get dbUsername(): string {
    return this.configService.getOrThrow<string>('app.db.username');
  }

  public get dbPassword(): string {
    return this.configService.getOrThrow<string>('app.db.password');
  }

  public get dbName(): string {
    return this.configService.getOrThrow<string>('app.db.name');
  }

  public get jwtAccessSecret(): string {
    return this.configService.getOrThrow<string>('app.jwt.accessSecret');
  }

  public get jwtAccessExpiration(): string {
    return this.configService.getOrThrow<string>('app.jwt.accessExpiration');
  }

  public get jwtRefreshSecret(): string {
    return this.configService.getOrThrow<string>('app.jwt.refreshSecret');
  }

  public get jwtRefreshExpiration(): string {
    return this.configService.getOrThrow<string>('app.jwt.refreshExpiration');
  }

  public get jwtIssuer(): string {
    return this.configService.getOrThrow<string>('app.jwt.issuer');
  }

  public get jwtAudience(): string {
    return this.configService.getOrThrow<string>('app.jwt.audience');
  }

  public get jwtStrictClaims(): boolean {
    return this.configService.getOrThrow<boolean>('app.jwt.strictClaims');
  }

  /**
   * Base64-encoded 32-byte AES-256 key used to encrypt SSO provider tokens
   * at rest. Must be present in production; the crypto vault throws on
   * first use if it isn't configured correctly.
   */
  public get ssoTokenEncryptionKey(): string {
    return this.configService.getOrThrow<string>('app.security.ssoTokenEncryptionKey');
  }

  public get ssoExchangeCodeTtlSeconds(): number {
    return this.configService.getOrThrow<number>('app.security.ssoExchangeCodeTtlSeconds');
  }

  public get loginLockoutThreshold(): number {
    return this.configService.getOrThrow<number>('app.security.loginLockoutThreshold');
  }

  public get loginLockoutWindowMin(): number {
    return this.configService.getOrThrow<number>('app.security.loginLockoutWindowMin');
  }

  public get throttleRedisPrefix(): string {
    return this.configService.getOrThrow<string>('app.security.throttleRedisPrefix');
  }

  public get publicEndpointApiKey(): string {
    return this.configService.getOrThrow<string>('app.security.publicEndpointApiKey');
  }

  public get resendApiKey(): string {
    return this.configService.getOrThrow<string>('app.resend.apiKey');
  }

  public get resendPloyosEmail(): string {
    return this.configService.getOrThrow<string>('app.resend.ployosEmail');
  }

  public get resendLonaEmail(): string {
    return this.configService.getOrThrow<string>('app.resend.lonaEmail');
  }

  public get paymentProcessor(): string {
    return this.configService.getOrThrow<string>('app.payment.processor');
  }

  public get polarAccessToken(): string {
    return this.configService.getOrThrow<string>('app.payment.polar.accessToken');
  }

  public get polarServer(): 'sandbox' | 'production' {
    return this.configService.getOrThrow<'sandbox' | 'production'>('app.payment.polar.server');
  }

  public get polarWebhookSecret(): string {
    return this.configService.getOrThrow<string>('app.payment.polar.webhookSecret');
  }

  public get polarTopUpProductId(): string {
    return this.configService.getOrThrow<string>('app.payment.polar.topUpProductId');
  }

  public get polarInvoiceProductId(): string {
    return this.configService.getOrThrow<string>('app.payment.polar.invoiceProductId');
  }

  public get stripeSecretKey(): string {
    return this.configService.getOrThrow<string>('app.payment.stripe.secretKey');
  }

  public get stripeWebhookSecret(): string {
    return this.configService.getOrThrow<string>('app.payment.stripe.webhookSecret');
  }

  public get stripeConnectClientId(): string {
    return this.configService.getOrThrow<string>('app.payment.stripe.connectClientId');
  }

  public get googleClientId(): string | undefined {
    return this.configService.get<string>('app.google.clientId');
  }

  public get googleClientSecret(): string | undefined {
    return this.configService.get<string>('app.google.clientSecret');
  }

  public get googleCallbackUrl(): string | undefined {
    return this.configService.get<string>('app.google.callbackUrl');
  }

  public get isGoogleOAuthConfigured(): boolean {
    return !!(this.googleClientId && this.googleClientSecret && this.googleCallbackUrl);
  }

  /** Base URL for the Business platform frontend (Ployos). */
  public get ployosUrl(): string {
    return this.configService.getOrThrow<string>('app.ployosUrl');
  }

  /** Base URL for the Consultant platform frontend (Lona). */
  public get lonaUrl(): string {
    return this.configService.getOrThrow<string>('app.lonaUrl');
  }

  /** Base URL for the Admin internal hub frontend. */
  public get internalHubUrl(): string {
    return this.configService.getOrThrow<string>('app.internalHubUrl');
  }

  public get redisHost(): string {
    return this.configService.getOrThrow<string>('app.redis.host');
  }

  public get redisPort(): number {
    return this.configService.getOrThrow<number>('app.redis.port');
  }

  public get redisPassword(): string | undefined {
    return this.configService.get<string>('app.redis.password') || undefined;
  }

  public get redisDb(): number {
    return this.configService.getOrThrow<number>('app.redis.db');
  }

  public get redisKeyPrefix(): string {
    return this.configService.getOrThrow<string>('app.redis.keyPrefix');
  }

  public get redisTlsEnabled(): boolean {
    return this.configService.getOrThrow<boolean>('app.redis.tlsEnabled');
  }

  public get copyleaksApiKey(): string {
    return this.configService.getOrThrow<string>('app.copyleaks.apiKey');
  }

  public get filesStorageProvider(): FilesStorageProviderName {
    return this.configService.getOrThrow<FilesStorageProviderName>('app.files.storageProvider');
  }

  public get filesMaxSizeBytes(): number {
    return this.configService.getOrThrow<number>('app.files.maxSizeBytes');
  }

  public get filesAllowedMimeList(): string[] {
    return this.configService.getOrThrow<string[]>('app.files.allowedMimeList');
  }

  public get filesUserQuotaBytes(): number {
    return this.configService.getOrThrow<number>('app.files.userQuotaBytes');
  }

  public get filesUserMaxCount(): number {
    return this.configService.getOrThrow<number>('app.files.userMaxCount');
  }

  public get filesPurgeAfterDays(): number {
    return this.configService.getOrThrow<number>('app.files.purgeAfterDays');
  }

  public get filesOrphanGraceHours(): number {
    return this.configService.getOrThrow<number>('app.files.orphanGraceHours');
  }

  public get filesMaxImagePixels(): number | null {
    return this.configService.get<number | null>('app.files.maxImagePixels') ?? null;
  }

  public get filesLocalPath(): string {
    return this.configService.getOrThrow<string>('app.files.local.path');
  }

  public get filesLocalPublicBaseUrl(): string {
    return this.configService.getOrThrow<string>('app.files.local.publicBaseUrl');
  }

  public get awsS3Region(): string {
    return this.configService.getOrThrow<string>('app.awsS3.region');
  }

  public get awsS3AccessKeyId(): string {
    return this.configService.getOrThrow<string>('app.awsS3.accessKeyId');
  }

  public get awsS3SecretAccessKey(): string {
    return this.configService.getOrThrow<string>('app.awsS3.secretAccessKey');
  }

  public get awsS3DefaultBucket(): string {
    return this.configService.getOrThrow<string>('app.awsS3.defaultBucket');
  }

  public get awsS3PresignTtlSeconds(): number {
    return this.configService.getOrThrow<number>('app.awsS3.presignTtlSeconds');
  }

  public get awsS3Endpoint(): string {
    return this.configService.get<string>('app.awsS3.endpoint') ?? '';
  }

  /**
   * Master key set used to encrypt `ai_provider_api_key.key_ciphertext` at
   * rest. Both `currentVersion` and at least one `versions` entry are
   * required for the service to start; the cipher validates this on first
   * use and throws a typed error if violated.
   */
  public get aiKeysMaster(): IAiKeysVersionedSecrets {
    return this.configService.getOrThrow<IAiKeysVersionedSecrets>('app.aiKeys.master');
  }

  /**
   * Secret set shared with the FE BFF for wrapping the GET /ai-provider-keys/active
   * response. Same versioning scheme as `aiKeysMaster`.
   */
  public get aiKeysBff(): IAiKeysVersionedSecrets {
    return this.configService.getOrThrow<IAiKeysVersionedSecrets>('app.aiKeys.bff');
  }

  public get identityServiceGrpcUrl(): string {
    return this.configService.getOrThrow<string>('app.identity.grpcUrl');
  }

  public get profilesServiceGrpcUrl(): string {
    return this.configService.getOrThrow<string>('app.profiles.grpcUrl');
  }

  public get projectsServiceGrpcUrl(): string {
    return this.configService.getOrThrow<string>('app.projects.grpcUrl');
  }

  public get financeServiceGrpcUrl(): string {
    return this.configService.getOrThrow<string>('app.finance.grpcUrl');
  }

  public get platformServiceGrpcUrl(): string {
    return this.configService.getOrThrow<string>('app.platform.grpcUrl');
  }
}
