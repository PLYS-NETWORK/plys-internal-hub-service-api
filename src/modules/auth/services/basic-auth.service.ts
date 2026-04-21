import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { AuthTokenType } from '@database/enums/auth-token-type.enum';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Not } from 'typeorm';

import {
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
} from '../dto';
import { IBasicAuthService, ISessionContext } from '../interfaces/auth-service.interface';
import { sha256 } from '../utils/auth.utils';
import { SessionService } from './session.service';
import { UserOnboardingService } from './user-onboarding.service';

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

@Injectable()
export class BasicAuthService implements IBasicAuthService {
  private readonly logger = new Logger(BasicAuthService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly onboardingService: UserOnboardingService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {}

  // ─── Register ────────────────────────────────────────────────────────────

  public async register(dto: RegisterDto, _context: ISessionContext): Promise<void> {
    this.logger.log(
      `[${this.rid}] register — start | email: ${dto.email}, platform: ${dto.active_platform}`,
    );

    // Defence-in-depth: the DTO already forbids ADMIN via @IsIn, but guard here
    // too so any internal caller that bypasses the DTO cannot create an admin.
    if (dto.active_platform === ActivePlatform.ADMIN_PLATFORM) {
      this.logger.warn(
        `[${this.rid}] register — blocked admin self-registration | email: ${dto.email}`,
      );
      throw new TranslatableException({
        messageKey: 'error.auth.admin_self_registration_forbidden',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.FORBIDDEN,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      const existing = await tx.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

      if (existing) {
        // Branch 1: already verified — hard conflict
        if (existing.isEmailVerified) {
          this.logger.warn(
            `[${this.rid}] register — email already registered | email: ${dto.email}, platform: ${dto.active_platform}`,
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
          this.logger.warn(
            `[${this.rid}] register — email pending verification | email: ${dto.email}`,
          );
          throw new TranslatableException({
            messageKey: 'error.auth.email_pending_verification',
            errorCode: ERROR_CODES.AUTH_EMAIL_PENDING_VERIFICATION,
            status: HttpStatus.CONFLICT,
          });
        }

        // Branch 3: all tokens expired — transparently re-issue a new token
        this.logger.log(
          `[${this.rid}] register — re-issuing verification token | email: ${dto.email}`,
        );
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

    this.logger.log(`[${this.rid}] register — complete | email: ${dto.email}`);
  }

  // ─── Verify Email ────────────────────────────────────────────────────────

  public async verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto> {
    this.logger.log(`[${this.rid}] verifyEmail — start`);
    const tokenHash = sha256(token);

    const authToken = await this.uow.authTokens.findOne({
      where: { tokenHash, type: AuthTokenType.EMAIL_VERIFICATION },
      relations: ['user'],
    });

    if (!authToken) {
      this.logger.warn(`[${this.rid}] verifyEmail — token not found`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (authToken.usedAt) {
      this.logger.warn(
        `[${this.rid}] verifyEmail — token already used | userId: ${authToken.userId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.auth.token_already_used',
        errorCode: ERROR_CODES.AUTH_TOKEN_ALREADY_USED,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (authToken.expiresAt < new Date()) {
      this.logger.warn(`[${this.rid}] verifyEmail — token expired | userId: ${authToken.userId}`);
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

    this.logger.log(`[${this.rid}] verifyEmail — complete | userId: ${authToken.userId}`);

    // Fire-and-forget: welcome email is non-critical; verification state is
    // already committed. A delivery failure must not un-verify the account.
    const loginUrl = this.getPlatformUrl(authToken.user.platform) + '/login';
    this.emailService
      .sendWelcomeEmail(
        authToken.user.email,
        { userName: authToken.user.email, loginUrl },
        authToken.user.platform,
      )
      .catch((err: Error) =>
        this.logger.error(
          `[${this.rid}] verifyEmail — welcome email failed | error: ${err.message}`,
        ),
      );

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
      `[${this.rid}] login — start | email: ${dto.email}, platform: ${dto.active_platform}`,
    );

    const user = await this.uow.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

    // Use generic "invalid credentials" to prevent user enumeration
    if (!user) {
      this.logger.warn(`[${this.rid}] login — user not found | email: ${dto.email}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isActive) {
      this.logger.warn(`[${this.rid}] login — account inactive | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.account_inactive',
        errorCode: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
        status: HttpStatus.FORBIDDEN,
      });
    }

    if (!user.passwordHash) {
      // No password on this account — cannot authenticate via email/password flow
      this.logger.warn(`[${this.rid}] login — no password set | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`[${this.rid}] login — invalid password | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isEmailVerified) {
      this.logger.warn(`[${this.rid}] login — email not verified | userId: ${user.id}`);

      // Credentials are valid but the account is unverified. Re-issue a fresh
      // verification token so the user can unblock themselves without needing
      // a separate resend step. Best-effort: if delivery fails we still return
      // 403 and do not surface the delivery error to the caller.
      try {
        await this.uow.withTransaction(async (tx) => {
          await this.issueVerificationToken(tx, user.id, user.email, user.email, user.platform);
        });
        this.logger.log(`[${this.rid}] login — re-issued verification email | userId: ${user.id}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[${this.rid}] login — failed to re-issue verification email | userId: ${user.id} | error: ${message}`,
        );
      }

      throw new TranslatableException({
        messageKey: 'error.auth.email_not_verified',
        errorCode: ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED,
        status: HttpStatus.FORBIDDEN,
      });
    }

    user.lastLoginAt = new Date();
    await this.uow.users.save(user);

    this.logger.log(`[${this.rid}] login — complete | userId: ${user.id}`);
    return this.sessionService.createSession(user.id, user.email, dto.active_platform, context);
  }

  // ─── Change Password ─────────────────────────────────────────────────────

  public async changePassword(dto: ChangePasswordDto): Promise<void> {
    const userId = this.requestContext.userId;
    const currentSessionId = this.requestContext.sessionId;
    this.logger.log(`[${this.rid}] changePassword — start | userId: ${userId}`);

    const user = userId ? await this.uow.users.findByActiveId(userId) : null;

    if (!user || !user.isActive) {
      this.logger.warn(
        `[${this.rid}] changePassword — user not found or inactive | userId: ${userId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (!user.passwordHash) {
      // Account has no password — cannot change what does not exist
      this.logger.warn(`[${this.rid}] changePassword — no password set | userId: ${user.id}`);
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const passwordValid = await bcrypt.compare(dto.current_password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(
        `[${this.rid}] changePassword — current password incorrect | userId: ${user.id}`,
      );
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

    this.logger.log(`[${this.rid}] changePassword — complete | userId: ${user.id}`);
  }

  // ─── Resend Verification ─────────────────────────────────────────────────

  public async resendVerification(dto: ResendVerificationDto): Promise<void> {
    this.logger.log(
      `[${this.rid}] resendVerification — start | email: ${dto.email}, platform: ${dto.active_platform}`,
    );

    // Always return success to prevent user enumeration. The actual send
    // happens only when a matching unverified account exists.
    const user = await this.uow.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

    if (!user || user.isEmailVerified) {
      // No account, or account already verified — silently succeed
      this.logger.warn(
        `[${this.rid}] resendVerification — noop (not found or already verified) | email: ${dto.email}`,
      );
      return;
    }

    await this.uow.withTransaction(async (tx) => {
      // Issue a new token regardless of whether a valid one already exists.
      // This covers the "resend" button path — user wants a fresh email.
      await this.issueVerificationToken(tx, user.id, user.email, user.email, user.platform);
    });

    this.logger.log(`[${this.rid}] resendVerification — complete | email: ${dto.email}`);
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
   * BUSINESS → PLOYOS_URL, CONSULTANT → LONA_URL, ADMIN → PLOYOS_URL (fallback).
   */
  private getPlatformUrl(platform: ActivePlatform): string {
    return platform === ActivePlatform.CONSULTANT
      ? this.envService.lonaUrl
      : this.envService.ployosUrl;
  }
}
