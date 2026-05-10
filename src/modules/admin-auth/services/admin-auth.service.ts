import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { IAdminOtpEmailOptions } from '@common/modules/email/interfaces/email-send-options.interface';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { User } from '@database/entities/auth/user.entity';
import { ActivePlatform, AuthTokenType, UserRole } from '@database/enums';
import { AuthResponseDto } from '@modules/auth/dto/responses/auth-response.dto';
import { ISessionContext } from '@modules/auth/interfaces/auth-service.interface';
import { SessionService } from '@modules/auth/services/session.service';
import { sha256 } from '@modules/auth/utils/auth.utils';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { AdminRequestOtpDto } from '../dto/requests/admin-request-otp.dto';
import { AdminVerifyOtpDto } from '../dto/requests/admin-verify-otp.dto';
import { IAdminAuthService } from '../interfaces/admin-auth-service.interface';
import { AdminOtpAttemptTracker } from './admin-otp-attempt-tracker.service';

// OTP validity window in milliseconds (10 minutes).
const OTP_TTL_MS = 10 * 60 * 1_000;
// Per-email resend limits.
const RESEND_WINDOW_LIMIT = 3;
const RESEND_WINDOW_TTL_SECONDS = 30 * 60;
const RESEND_DAILY_LIMIT = 10;
const RESEND_DAILY_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AdminAuthService implements IAdminAuthService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly sessionService: SessionService,
    private readonly emailService: EmailService,
    private readonly adminOtpAttemptTracker: AdminOtpAttemptTracker,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminAuthService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async requestOtp(
    dto: AdminRequestOtpDto,
    _sessionContext: ISessionContext,
  ): Promise<void> {
    const maskedEmail = this.maskEmail(dto.email);
    this.logger.log(`[${this.rid}] requestOtp — start | email: ${maskedEmail}`);

    await this.assertEmailAllowed(dto.email);
    await this.assertResendLimits(dto.email);

    const user = await this.findOrCreateAdminUser(dto.email);

    // Invalidate any previous unused ADMIN_OTP tokens for this user.
    await this.uow.authTokens.update(
      { userId: user.id, type: AuthTokenType.ADMIN_OTP, usedAt: null as unknown as Date },
      { usedAt: new Date() },
    );

    const otp = this.generateOtp();
    const token = this.uow.authTokens.create({
      userId: user.id,
      type: AuthTokenType.ADMIN_OTP,
      tokenHash: sha256(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      usedAt: null,
    });
    await this.uow.authTokens.save(token);

    const emailOptions: IAdminOtpEmailOptions = { otp };
    await this.emailService.sendAdminOtpEmail(dto.email, emailOptions);

    await this.incrementResendCounters(dto.email);

    this.logger.log(`[${this.rid}] requestOtp — complete | email: ${maskedEmail}`);
  }

  /** @inheritdoc */
  public async verifyOtp(
    dto: AdminVerifyOtpDto,
    sessionContext: ISessionContext,
  ): Promise<AuthResponseDto> {
    const maskedEmail = this.maskEmail(dto.email);
    this.logger.log(`[${this.rid}] verifyOtp — start | email: ${maskedEmail}`);

    if (!sessionContext.deviceId || !sessionContext.fingerprint) {
      throw new TranslatableException({
        messageKey: 'error.generic.bad_request',
        errorCode: ERROR_CODES.GENERIC_BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
        details: { reason: 'x-device-id and x-fingerprint headers are required for admin login' },
      });
    }

    await this.assertEmailAllowed(dto.email);
    await this.adminOtpAttemptTracker.assertNotLocked(dto.email);

    const user = await this.uow.users.findUserByEmailAndPlatform(
      dto.email,
      ActivePlatform.ADMIN_PLATFORM,
    );
    if (!user) {
      await this.adminOtpAttemptTracker.recordFailure(dto.email);
      this.logger.warn(`[${this.rid}] verifyOtp — user not found | email: ${maskedEmail}`);
      throw new TranslatableException({
        messageKey: 'error.admin.otp_invalid',
        errorCode: ERROR_CODES.ADMIN_AUTH_OTP_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isActive) {
      this.logger.warn(`[${this.rid}] verifyOtp — account inactive | email: ${maskedEmail}`);
      throw new TranslatableException({
        messageKey: 'error.generic.forbidden',
        errorCode: ERROR_CODES.GENERIC_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      });
    }

    const tokenHash = sha256(dto.otp);
    const token = await this.uow.authTokens.findOneBy({
      tokenHash,
      type: AuthTokenType.ADMIN_OTP,
    });

    if (!token || token.userId !== user.id) {
      await this.adminOtpAttemptTracker.recordFailure(dto.email);
      this.logger.warn(`[${this.rid}] verifyOtp — token not found | email: ${maskedEmail}`);
      throw new TranslatableException({
        messageKey: 'error.admin.otp_invalid',
        errorCode: ERROR_CODES.ADMIN_AUTH_OTP_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (token.usedAt !== null) {
      await this.adminOtpAttemptTracker.recordFailure(dto.email);
      this.logger.warn(`[${this.rid}] verifyOtp — token already used | email: ${maskedEmail}`);
      throw new TranslatableException({
        messageKey: 'error.admin.otp_invalid',
        errorCode: ERROR_CODES.ADMIN_AUTH_OTP_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (token.expiresAt < new Date()) {
      await this.adminOtpAttemptTracker.recordFailure(dto.email);
      this.logger.warn(`[${this.rid}] verifyOtp — token expired | email: ${maskedEmail}`);
      throw new TranslatableException({
        messageKey: 'error.admin.otp_invalid',
        errorCode: ERROR_CODES.ADMIN_AUTH_OTP_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    token.usedAt = new Date();
    await this.uow.authTokens.save(token);

    await this.adminOtpAttemptTracker.reset(dto.email);

    const [authResponse] = await Promise.all([
      this.sessionService.createSession(
        user.id,
        user.email,
        ActivePlatform.ADMIN_PLATFORM,
        sessionContext,
      ),
      this.uow.users.update(user.id, { lastLoginAt: new Date() }),
    ]);

    this.logger.log(`[${this.rid}] verifyOtp — complete | email: ${maskedEmail}`);
    return authResponse;
  }

  private async findOrCreateAdminUser(email: string): Promise<User> {
    const existing = await this.uow.users.findUserByEmailAndPlatform(
      email,
      ActivePlatform.ADMIN_PLATFORM,
    );
    if (existing) return existing;

    // Auto-provision admin user on first OTP request. No profile creation needed.
    const newUser = this.uow.users.create({
      email,
      platform: ActivePlatform.ADMIN_PLATFORM,
      role: UserRole.ADMIN_PLATFORM,
      isActive: true,
      passwordHash: null,
    });
    await this.uow.users.save(newUser);
    // TypeORM may omit boolean columns with @Column({ default: false }) from the
    // INSERT. Explicit UPDATE guarantees is_email_verified = true is written.
    await this.uow.users.update(newUser.id, { isEmailVerified: true });
    return (await this.uow.users.findOneBy({ id: newUser.id }))!;
  }

  private async assertEmailAllowed(email: string): Promise<void> {
    const allowed = await this.uow.adminAllowedEmails.findActiveByEmail(email);
    if (!allowed) {
      this.logger.warn(
        `[${this.rid}] assertEmailAllowed — email not whitelisted | email: ${this.maskEmail(email)}`,
      );
      throw new TranslatableException({
        messageKey: 'error.admin.email_not_allowed',
        errorCode: ERROR_CODES.ADMIN_AUTH_EMAIL_NOT_ALLOWED,
        status: HttpStatus.FORBIDDEN,
      });
    }
  }

  private async assertResendLimits(email: string): Promise<void> {
    const emailKey = email.toLowerCase();

    const windowKey = `admin:otp:resend:window:${emailKey}`;
    const dailyKey = `admin:otp:resend:daily:${emailKey}`;

    const [windowCount, dailyCount] = await Promise.all([
      this.redis.get(windowKey),
      this.redis.get(dailyKey),
    ]);

    const window = windowCount ? parseInt(windowCount, 10) : 0;
    const daily = dailyCount ? parseInt(dailyCount, 10) : 0;

    if (window >= RESEND_WINDOW_LIMIT || daily >= RESEND_DAILY_LIMIT) {
      this.logger.warn(
        `[${this.rid}] assertResendLimits — limit reached | email: ${this.maskEmail(email)}, window: ${window}, daily: ${daily}`,
      );
      throw new TranslatableException({
        messageKey: 'error.admin.resend_limit',
        errorCode: ERROR_CODES.ADMIN_AUTH_RESEND_LIMIT,
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    }
  }

  private async incrementResendCounters(email: string): Promise<void> {
    const emailKey = email.toLowerCase();

    const windowKey = `admin:otp:resend:window:${emailKey}`;
    const dailyKey = `admin:otp:resend:daily:${emailKey}`;

    const [windowCount, dailyCount] = await Promise.all([
      this.redis.incr(windowKey),
      this.redis.incr(dailyKey),
    ]);

    // Set TTL only on first increment so subsequent increments keep the original window.
    if (windowCount === 1) await this.redis.expire(windowKey, RESEND_WINDOW_TTL_SECONDS);
    if (dailyCount === 1) await this.redis.expire(dailyKey, RESEND_DAILY_TTL_SECONDS);
  }

  private generateOtp(): string {
    return String(Math.floor(100_000 + Math.random() * 900_000));
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 3)}***@${domain}`;
  }
}
