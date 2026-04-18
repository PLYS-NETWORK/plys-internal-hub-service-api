import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IEnvironmentsService } from './interfaces';

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

  public get resendApiKey(): string {
    return this.configService.getOrThrow<string>('app.resend.apiKey');
  }

  public get resendFromEmail(): string {
    return this.configService.getOrThrow<string>('app.resend.fromEmail');
  }

  public get paymentProcessor(): string {
    return this.configService.getOrThrow<string>('app.payment.processor');
  }

  public get polarAccessToken(): string {
    return this.configService.getOrThrow<string>('app.payment.polar.accessToken');
  }

  public get polarWebhookSecret(): string {
    return this.configService.getOrThrow<string>('app.payment.polar.webhookSecret');
  }

  public get stripeSecretKey(): string {
    return this.configService.getOrThrow<string>('app.payment.stripe.secretKey');
  }

  public get stripeWebhookSecret(): string {
    return this.configService.getOrThrow<string>('app.payment.stripe.webhookSecret');
  }
}
