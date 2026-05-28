import { HttpStatus, Injectable } from '@nestjs/common';
import { NOTIFICATION_TYPES } from '@plys/libraries/api-contracts/notifications/enums/notification-type.enum';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { EmailService } from '@plys/libraries/common-nest/modules/email/email.service';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientService } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { maskEmailForLog } from '@plys/libraries/common-nest/utils/mask-email.util';
import { ActivePlatform, AuthTokenType } from '@plys/libraries/database/enums';
import { IUnitOfWork } from '@plys/libraries/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Not } from 'typeorm';

import { ERROR_CODES } from '../../../errors/error-codes';
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
} from '../dto';
import { IBasicAuthService, ISessionContext } from '../interfaces/auth-service.interface';
import { sha256 } from '../utils/auth.utils';
import { LoginAttemptTracker } from './login-attempt-tracker.service';
import { SessionService } from './session.service';
import { UserOnboardingService } from './user-onboarding.service';

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_MINUTES = 15;
const PASSWORD_RESET_OTP_LENGTH = 6;

@Injectable()
export class BasicAuthService implements IBasicAuthService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly onboardingService: UserOnboardingService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
    private readonly loginAttemptTracker: LoginAttemptTracker,
    private readonly notificationsClient: NotificationsClientService,
  ) {
    this.logger = new AppLogger(BasicAuthService.name, requestContext);
  }

  // ─── Register ────────────────────────────────────────────────────────────

  public async register(dto: RegisterDto, _context: ISessionContext): Promise<void> {
    this.logger.log(`register — start | email: ${dto.email}, platform: ${dto.active_platform}`);

    // Defence-in-depth: the DTO already forbids ADMIN via @IsIn, but guard here
    // too so any internal caller that bypasses the DTO cannot create an admin.
    if (dto.active_platform === ActivePlatform.ADMIN_PLATFORM) {
      this.logger.warn(`register — blocked admin self-registration | email: ${dto.email}`);
      throw new TranslatableException({
        messageKey: 'error.auth.admin_self_registration_forbidden',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.FORBIDDEN,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      const existing = await tx.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

      // For consultant re-registration, check if the user is currently blocked from onboarding
      // (set when a previous onboarding was REJECTED, expires after 3 months).
      if (existing && dto.active_platform === ActivePlatform.CONSULTANT) {
        const latestOnboarding = await tx.consultantOnboardings.findByUserId(existing.id);
        if (latestOnboarding?.blockedUntil && latestOnboarding.blockedUntil > new Date()) {
          this.logger.warn(
            `register — consultant blocked | email: ${dto.email}, until: ${latestOnboarding.blockedUntil.toISOString()}`,
          );
          throw new TranslatableException({
            messageKey: 'error.consultant_onboarding.blocked',
            errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_BLOCKED,
            status: HttpStatus.FORBIDDEN,
            details: { blocked_until: latestOnboarding.blockedUntil.toISOString() },
          });
        }
      }

      if (existing) {
        // Branch 1: already verified — hard conflict
        if (existing.isEmailVerified) {
          this.logger.warn(
            `register — email already registered | email: ${dto.email}, platform: ${dto.active_platform}`,
          );
          throw new TranslatableException({
            messageKey: 'error.auth.email_already_registered',
            errorCode: ERROR_CODES.AUTH_EMAIL_ALREADY_REGISTERED,
            status: HttpStatus.CONFLICT,
          });
        }

        // Branch 2/3: unverified — check whether there is a still-valid token
        const validToken = await tx.authTokens.findOne({
          where: {
            userId: existing.id,
            type: AuthTokenType.EMAIL_VERIFICATION,
            usedAt: null as unknown as Date,
          },
          order: { createdAt: 'DESC' },
        });

        const hasValidToken =
          validToken !== null && validToken !== undefined && validToken.expiresAt > new Date();

        if (hasValidToken) {
          // Branch 2: token still alive — tell the user to check their inbox
          this.logger.warn(`register — email pending verification | email: ${dto.email}`);
          throw new TranslatableException({
            messageKey: 'error.auth.email_pending_verification',
            errorCode: ERROR_CODES.AUTH_EMAIL_PENDING_VERIFICATION,
            status: HttpStatus.CONFLICT,
          });
        }

        // Branch 3: all tokens expired — transparently re-issue a new token
        this.logger.log(`register — re-issuing verification token | email: ${dto.email}`);
        await this.issueVerificationToken(
          tx,
          existing.id,
          existing.email,
          dto.email,
          dto.active_platform,
        );
        return;
      }

      // New user path
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      const user = tx.users.create({
        email: dto.email.toLowerCase().trim(),
        platform: dto.active_platform,
        passwordHash,
        isEmailVerified: false,
        isActive: true,
      });
      await tx.users.save(user);

      const displayName = await this.onboardingService.createInitialProfile(tx, user.id, dto);

      await this.issueVerificationToken(tx, user.id, displayName, dto.email, dto.active_platform);
    });

    this.logger.log(`register — complete | email: ${dto.email}`);
  }

  // ─── Verify Email ────────────────────────────────────────────────────────

  public async verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto> {
    this.logger.log(`verifyEmail — start`);
    const tokenHash = sha256(token);

    const authToken = await this.uow.authTokens.findOne({
      where: { tokenHash, type: AuthTokenType.EMAIL_VERIFICATION },
      relations: ['user'],
    });

    if (!authToken) {
      this.logger.warn(`verifyEmail — token not found`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (authToken.usedAt) {
      this.logger.warn(`verifyEmail — token already used | userId: ${authToken.userId}`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_already_used',
        errorCode: ERROR_CODES.AUTH_TOKEN_ALREADY_USED,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (authToken.expiresAt < new Date()) {
      this.logger.warn(`verifyEmail — token expired | userId: ${authToken.userId}`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_expired',
        errorCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      authToken.usedAt = new Date();
      await tx.authTokens.save(authToken);

      authToken.user.isEmailVerified = true;
      authToken.user.emailVerifiedAt = new Date();
      authToken.user.lastLoginAt = new Date();
      await tx.users.save(authToken.user);
    });

    this.logger.log(`verifyEmail — complete | userId: ${authToken.userId}`);

    // Fire-and-forget: welcome email is non-critical; verification state is
    // already committed. A delivery failure must not un-verify the account.
    void (async (): Promise<void> => {
      try {
        let dashboardUrl = this.getPlatformUrl(authToken.user.platform);

        if (authToken.user.platform === ActivePlatform.BUSINESS) {
          // For business users, construct URL with business profile ID
          const businessProfile = await this.uow.businessProfiles.findOne({
            where: { userId: authToken.userId },
          });

          if (businessProfile) {
            dashboardUrl += `/overview`;
          } else {
            // Fallback to generic dashboard if business profile not found
            dashboardUrl += '/dashboard';
          }
        } else {
          // For consultant/admin users, use generic dashboard
          dashboardUrl += '/dashboard';
        }

        await this.emailService.sendWelcomeEmail(
          authToken.user.email,
          { userName: authToken.user.email, dashboardUrl },
          authToken.user.platform,
        );
      } catch (err: unknown) {
        this.logger.error(
          `verifyEmail — welcome email failed | error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();

    return this.sessionService.createSession(
      authToken.user.id,
      authToken.user.email,
      authToken.user.platform,
      context,
    );
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  public async login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto> {
    this.logger.log(
      `login — start | email: ${this.emailForLog(dto.email)}, platform: ${dto.active_platform}`,
    );

    const user = await this.uow.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

    // Use generic "invalid credentials" to prevent user enumeration
    if (!user) {
      this.logger.warn(`login — user not found | email: ${this.emailForLog(dto.email)}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isActive) {
      this.logger.warn(`login — account inactive | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.account_inactive',
        errorCode: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
        status: HttpStatus.FORBIDDEN,
        // Expose ban_reason so the client can render the specific cause
        // ("Account banned for AI content abuse") instead of a generic message.
        details: user.banReason ? { ban_reason: user.banReason } : undefined,
      });
    }

    if (!user.passwordHash) {
      // No password on this account — cannot authenticate via email/password flow
      this.logger.warn(`login — no password set | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // Account-level lockout: if too many failures have already accumulated
    // for this user, refuse before running the (intentionally slow) bcrypt
    // compare so the 429 response is fast.
    await this.loginAttemptTracker.assertNotLocked(user.id);

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      const count = await this.loginAttemptTracker.recordFailure(user.id);
      this.logger.warn(`login — invalid password | userId: ${user.id}, failureCount: ${count}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // Successful credential check resets the lockout counter immediately so a
    // user who recovers their password isn't penalised by older failures.
    await this.loginAttemptTracker.reset(user.id);

    if (!user.isEmailVerified) {
      this.logger.warn(`login — email not verified | userId: ${user.id}`);

      // Credentials are valid but the account is unverified. Re-issue a fresh
      // verification token so the user can unblock themselves without needing
      // a separate resend step. Best-effort: if delivery fails we still return
      // 403 and do not surface the delivery error to the caller.
      try {
        await this.uow.withTransaction(async (tx) => {
          await this.issueVerificationToken(tx, user.id, user.email, user.email, user.platform);
        });
        this.logger.log(`login — re-issued verification email | userId: ${user.id}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `login — failed to re-issue verification email | userId: ${user.id} | error: ${message}`,
        );
      }

      throw new TranslatableException({
        messageKey: 'error.auth.email_not_verified',
        errorCode: ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED,
        status: HttpStatus.FORBIDDEN,
      });
    }

    // Consultant-only: a REJECTED onboarding sets `blocked_until = now + 3 months`.
    // While that window is open the consultant must NOT be allowed back in (admin
    // already emailed them the rejection reason). After the window expires login is
    // allowed again and the consultant can re-onboard.
    await this.assertConsultantNotBlocked(user.id, dto.active_platform);

    user.lastLoginAt = new Date();
    await this.uow.users.save(user);

    this.logger.log(`login — complete | userId: ${user.id}`);
    return this.sessionService.createSession(user.id, user.email, dto.active_platform, context);
  }

  /**
   * For CONSULTANT logins: if the user has an onboarding row with an active
   * block (`blocked_until > now` from a prior admin REJECT), refuse login with
   * `CONSULTANT_ONBOARDING_BLOCKED`. No-op for other platforms.
   */
  private async assertConsultantNotBlocked(
    userId: string,
    activePlatform: ActivePlatform,
  ): Promise<void> {
    if (activePlatform !== ActivePlatform.CONSULTANT) return;
    const onboarding = await this.uow.consultantOnboardings.findByUserId(userId);
    if (onboarding?.blockedUntil && onboarding.blockedUntil > new Date()) {
      this.logger.warn(
        `login — consultant blocked | userId: ${userId} | until: ${onboarding.blockedUntil.toISOString()}`,
      );
      throw new TranslatableException({
        messageKey: 'error.consultant_onboarding.blocked',
        errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_BLOCKED,
        status: HttpStatus.FORBIDDEN,
        details: { blocked_until: onboarding.blockedUntil.toISOString() },
      });
    }
  }

  // ─── Change Password ─────────────────────────────────────────────────────

  public async changePassword(dto: ChangePasswordDto): Promise<void> {
    const userId = this.requestContext.userId;
    const currentSessionId = this.requestContext.sessionId;
    this.logger.log(`changePassword — start | userId: ${userId}`);

    const user = userId ? await this.uow.users.findByActiveId(userId) : null;

    if (!user || !user.isActive) {
      this.logger.warn(`changePassword — user not found or inactive | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (!user.passwordHash) {
      // Account has no password — cannot change what does not exist
      this.logger.warn(`changePassword — no password set | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const passwordValid = await bcrypt.compare(dto.current_password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`changePassword — current password incorrect | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      user.passwordHash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
      await tx.users.save(user);

      // Revoke all OTHER sessions to force re-login on other devices
      if (currentSessionId) {
        await tx.userSessions.delete({
          userId: user.id,
          id: Not(currentSessionId),
        });
      }
    });

    // Fire-and-forget — security audit so other devices/tabs see the change.
    this.notificationsClient.dispatch({
      userId: user.id,
      type: NOTIFICATION_TYPES.PASSWORD_CHANGED,
      metadata: {
        device_id: this.requestContext.deviceId,
        ip_address: this.requestContext.ipAddress,
      },
      actorId: user.id,
    });

    this.logger.log(`changePassword — complete | userId: ${user.id}`);
  }

  // ─── Resend Verification ─────────────────────────────────────────────────

  public async resendVerification(dto: ResendVerificationDto): Promise<void> {
    this.logger.log(
      `resendVerification — start | email: ${dto.email}, platform: ${dto.active_platform}`,
    );

    // Always return success to prevent user enumeration. The actual send
    // happens only when a matching unverified account exists.
    const user = await this.uow.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

    if (!user || user.isEmailVerified) {
      // No account, or account already verified — silently succeed
      this.logger.warn(
        `resendVerification — noop (not found or already verified) | email: ${dto.email}`,
      );
      return;
    }

    await this.uow.withTransaction(async (tx) => {
      // Issue a new token regardless of whether a valid one already exists.
      // This covers the "resend" button path — user wants a fresh email.
      await this.issueVerificationToken(tx, user.id, user.email, user.email, user.platform);
    });

    this.logger.log(`resendVerification — complete | email: ${dto.email}`);
  }

  // ─── Password Reset ──────────────────────────────────────────────────────

  /**
   * Issues a one-time numeric OTP to the user's email if a matching
   * unverified-or-active account exists. Always returns void to avoid
   * disclosing account existence (combine with throttling on the route).
   */
  public async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    this.logger.log(
      `requestPasswordReset — start | email: ${dto.email}, platform: ${dto.activePlatform}`,
    );

    const user = await this.uow.users.findUserByEmailAndPlatform(dto.email, dto.activePlatform);

    if (!user || !user.isActive || !user.passwordHash) {
      // Either no user, deactivated, or SSO-only (no password to reset).
      // Silent no-op — the controller still returns 200.
      this.logger.warn(
        `requestPasswordReset — noop (no active password account) | email: ${dto.email}`,
      );
      return;
    }

    // 6-digit numeric OTP. With per-IP+email throttling and a 15-minute
    // window, brute-force probability is ~150/1_000_000 = 0.015%.
    const otp = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(
      PASSWORD_RESET_OTP_LENGTH,
      '0',
    );
    const otpHash = sha256(otp);

    await this.uow.withTransaction(async (tx) => {
      const authToken = tx.authTokens.create({
        userId: user.id,
        type: AuthTokenType.PASSWORD_RESET,
        tokenHash: otpHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000),
      });
      await tx.authTokens.save(authToken);

      // Awaited inside the transaction: if delivery fails the token row is
      // rolled back and the API returns an error so the caller can retry.
      await this.emailService.sendForgotPasswordOtpEmail(
        user.email,
        {
          userName: user.email,
          otp,
          expiryMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
        },
        user.platform,
      );
    });

    this.logger.log(`requestPasswordReset — complete | userId: ${user.id}`);
  }

  /**
   * Validates the OTP, sets a new password hash, and revokes every session
   * for the user so all devices are signed out.
   */
  public async resetPassword(dto: ResetPasswordDto): Promise<void> {
    this.logger.log(
      `resetPassword — start | email: ${this.emailForLog(dto.email)}, platform: ${dto.activePlatform}`,
    );

    const user = await this.uow.users.findUserByEmailAndPlatform(dto.email, dto.activePlatform);
    if (!user || !user.isActive) {
      // Generic invalid-token to prevent email enumeration via reset path.
      this.logger.warn(`resetPassword — user not found or inactive | email: ${dto.email}`);
      throw new TranslatableException({
        messageKey: 'error.auth.reset_token_invalid',
        errorCode: ERROR_CODES.AUTH_RESET_TOKEN_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const otpHash = sha256(dto.otp);
    const authToken = await this.uow.authTokens.findOne({
      where: {
        userId: user.id,
        tokenHash: otpHash,
        type: AuthTokenType.PASSWORD_RESET,
      },
    });

    if (!authToken) {
      this.logger.warn(`resetPassword — token not found | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.reset_token_invalid',
        errorCode: ERROR_CODES.AUTH_RESET_TOKEN_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (authToken.usedAt) {
      this.logger.warn(`resetPassword — token already used | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_already_used',
        errorCode: ERROR_CODES.AUTH_TOKEN_ALREADY_USED,
        status: HttpStatus.BAD_REQUEST,
      });
    }
    if (authToken.expiresAt < new Date()) {
      this.logger.warn(`resetPassword — token expired | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.reset_token_expired',
        errorCode: ERROR_CODES.AUTH_RESET_TOKEN_EXPIRED,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      authToken.usedAt = new Date();
      await tx.authTokens.save(authToken);

      user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
      await tx.users.save(user);

      // Revoke every session — user must sign in again on every device.
      await tx.userSessions.delete({ userId: user.id });
    });

    this.logger.log(`resetPassword — complete | userId: ${user.id}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Creates a fresh EMAIL_VERIFICATION auth_token row and sends the
   * verification email. Must be called inside an active transaction so a
   * delivery failure rolls back the token insert.
   */
  private async issueVerificationToken(
    tx: IUnitOfWork,
    userId: string,
    displayName: string,
    recipientEmail: string,
    platform: ActivePlatform,
  ): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = sha256(rawToken);

    const authToken = tx.authTokens.create({
      userId,
      type: AuthTokenType.EMAIL_VERIFICATION,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000),
    });
    await tx.authTokens.save(authToken);

    const baseUrl = this.getPlatformUrl(platform);
    const verificationUrl = `${baseUrl}/verify-email?token=${rawToken}`;

    // Awaited inside the transaction: if delivery fails the entire transaction
    // rolls back and the API returns an error so the caller knows to retry.
    await this.emailService.sendVerificationEmail(
      recipientEmail,
      {
        userName: displayName,
        verificationUrl,
        expiryHours: EMAIL_VERIFICATION_EXPIRY_HOURS,
      },
      platform,
    );
  }

  /**
   * Returns the base frontend URL for the given platform.
   * BUSINESS → PLOYOS_URL, CONSULTANT → LONAOS_URL, ADMIN → PLOYOS_URL (fallback).
   */
  private getPlatformUrl(platform: ActivePlatform): string {
    return platform === ActivePlatform.CONSULTANT
      ? this.envService.lonaosUrl
      : this.envService.ployosUrl;
  }

  private emailForLog(email: string): string {
    return this.envService.isProduction ? maskEmailForLog(email) : email;
  }
}
