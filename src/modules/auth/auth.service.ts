import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Not } from 'typeorm';

import { ERROR_CODES } from '../../common/constants/error-codes';
import { TranslatableException } from '../../common/exceptions/translatable.exception';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { EmailService } from '../../common/modules/email/email.service';
import { EnvironmentsService } from '../../common/modules/environments';
import { ActivePlatform } from '../../database/enums/active-platform.enum';
import { AuthTokenType } from '../../database/enums/auth-token-type.enum';
import { SsoProvider } from '../../database/enums/sso-provider.enum';
import { UnitOfWorkService } from '../unit-of-work/unit-of-work.service';
import { AuthResponseDto, ChangePasswordDto, LoginDto, RegisterDto, UserResponseDto } from './dto';
import { IAuthService, ISessionContext, ISsoUserData } from './interfaces/auth-service.interface';

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly envService: EnvironmentsService,
  ) {
    this.googleClient = new OAuth2Client(this.envService.googleClientId);
  }

  // ─── Register ────────────────────────────────────────────────────────────

  public async register(dto: RegisterDto, _context: ISessionContext): Promise<void> {
    await this.uow.withTransaction(async (tx) => {
      // Case-insensitive uniqueness check via LOWER()
      const existing = await tx.users
        .createQueryBuilder('u')
        .where('LOWER(u.email) = LOWER(:email)', { email: dto.email })
        .getOne();

      if (existing) {
        throw new TranslatableException({
          messageKey: 'error.auth.email_already_registered',
          errorCode: ERROR_CODES.AUTH_EMAIL_ALREADY_REGISTERED,
          status: HttpStatus.CONFLICT,
        });
      }

      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      const user = tx.users.create({
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        isEmailVerified: false,
        isActive: true,
      });
      await tx.users.save(user);

      // Generate verification token — raw token sent via email, SHA-256 stored in DB
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.sha256(rawToken);

      const authToken = tx.authTokens.create({
        userId: user.id,
        type: AuthTokenType.EMAIL_VERIFICATION,
        tokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000),
      });
      await tx.authTokens.save(authToken);

      const verificationUrl = `${this.envService.frontendUrl}/verify-email?token=${rawToken}`;

      // Fire-and-forget: email delivery failure should not roll back registration
      this.emailService
        .sendVerificationEmail(user.email, {
          userName: dto.firstName ?? user.email,
          verificationUrl,
          expiryHours: EMAIL_VERIFICATION_EXPIRY_HOURS,
        })
        .catch((err: Error) =>
          this.logger.error(`Failed to send verification email: ${err.message}`),
        );
    });
  }

  // ─── Verify Email ────────────────────────────────────────────────────────

  public async verifyEmail(token: string): Promise<void> {
    const tokenHash = this.sha256(token);

    const authToken = await this.uow.authTokens.findOne({
      where: { tokenHash, type: AuthTokenType.EMAIL_VERIFICATION },
      relations: ['user'],
    });

    if (!authToken) {
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (authToken.usedAt) {
      throw new TranslatableException({
        messageKey: 'error.auth.token_already_used',
        errorCode: ERROR_CODES.AUTH_TOKEN_ALREADY_USED,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    if (authToken.expiresAt < new Date()) {
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
      await tx.users.save(authToken.user);
    });

    // Send welcome email after successful verification
    this.emailService
      .sendWelcomeEmail(authToken.user.email, {
        userName: authToken.user.email,
        loginUrl: `${this.envService.frontendUrl}/login`,
      })
      .catch((err: Error) => this.logger.error(`Failed to send welcome email: ${err.message}`));
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  public async login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto> {
    const user = await this.uow.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    // Use generic "invalid credentials" to prevent user enumeration
    if (!user) {
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isActive) {
      throw new TranslatableException({
        messageKey: 'error.auth.account_inactive',
        errorCode: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
        status: HttpStatus.FORBIDDEN,
      });
    }

    if (!user.passwordHash) {
      // User registered via SSO and has no password set
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isEmailVerified) {
      throw new TranslatableException({
        messageKey: 'error.auth.email_not_verified',
        errorCode: ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED,
        status: HttpStatus.FORBIDDEN,
      });
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await this.uow.users.save(user);

    return this.createSession(user.id, user.email, dto.activePlatform, context);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────

  public async refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto> {
    const tokenHash = this.sha256(refreshToken);

    const session = await this.uow.userSessions.findOne({
      where: { sessionToken: tokenHash },
      relations: ['user'],
    });

    if (!session) {
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await this.uow.userSessions.remove(session);
      throw new TranslatableException({
        messageKey: 'error.auth.token_expired',
        errorCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const { userId, user, activePlatform } = session;

    // Refresh Token Rotation: delete old session, create fresh one
    await this.uow.userSessions.remove(session);

    return this.createSession(userId, user.email, activePlatform, context);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  public async logout(sessionId: string): Promise<void> {
    await this.uow.userSessions.delete({ id: sessionId });
  }

  // ─── Me ──────────────────────────────────────────────────────────────────

  public async me(userId: string): Promise<UserResponseDto> {
    const user = await this.uow.users.findByActiveId(userId);

    if (!user || !user.isActive) {
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  // ─── Change Password ────────────────────────────────────────────────────

  public async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentSessionId: string,
  ): Promise<void> {
    const user = await this.uow.users.findByActiveId(userId);

    if (!user || !user.isActive) {
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (!user.passwordHash) {
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const passwordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new TranslatableException({
        messageKey: 'error.auth.invalid_credentials',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
      await tx.users.save(user);

      // Revoke all OTHER sessions to force re-login on other devices
      await tx.userSessions.delete({
        userId: user.id,
        id: Not(currentSessionId),
      });
    });
  }

  // ─── SSO Login (token exchange for SPA/mobile) ──────────────────────────

  public async ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto> {
    if (!userData.email) {
      throw new TranslatableException({
        messageKey: 'error.auth.sso_email_missing',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const ssoProvider = provider as SsoProvider;
    const email = userData.email.toLowerCase().trim();

    // Check if this SSO identity is already linked
    const existingLink = await this.uow.userSsoProviders.findOne({
      where: { provider: ssoProvider, providerUserId: userData.providerUserId },
      relations: ['user'],
    });

    if (existingLink) {
      const user = existingLink.user;

      if (!user.isActive) {
        throw new TranslatableException({
          messageKey: 'error.auth.account_inactive',
          errorCode: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
          status: HttpStatus.FORBIDDEN,
        });
      }

      // Update SSO tokens
      existingLink.accessToken = userData.accessToken;
      existingLink.refreshToken = userData.refreshToken ?? null;
      await this.uow.userSsoProviders.save(existingLink);

      user.lastLoginAt = new Date();
      await this.uow.users.save(user);

      return this.createSession(user.id, user.email, activePlatform, context);
    }

    // SSO identity not linked yet — check if email matches an existing user
    return this.uow.withTransaction(async (tx) => {
      let user = await tx.users
        .createQueryBuilder('u')
        .where('LOWER(u.email) = LOWER(:email)', { email })
        .getOne();

      let isNewUser = false;

      if (!user) {
        // Create a new user — SSO users are auto-verified
        user = tx.users.create({
          email,
          passwordHash: null,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          isActive: true,
          lastLoginAt: new Date(),
        });
        await tx.users.save(user);
        isNewUser = true;
      } else {
        if (!user.isActive) {
          throw new TranslatableException({
            messageKey: 'error.auth.account_inactive',
            errorCode: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
            status: HttpStatus.FORBIDDEN,
          });
        }

        // Auto-verify email if not already verified (SSO confirms ownership)
        if (!user.isEmailVerified) {
          user.isEmailVerified = true;
          user.emailVerifiedAt = new Date();
        }
        user.lastLoginAt = new Date();
        await tx.users.save(user);
      }

      // Link the SSO provider to the user
      const ssoLink = tx.userSsoProviders.create({
        userId: user.id,
        provider: ssoProvider,
        providerUserId: userData.providerUserId,
        providerEmail: email,
        accessToken: userData.accessToken,
        refreshToken: userData.refreshToken ?? null,
      });
      await tx.userSsoProviders.save(ssoLink);

      const authResponse = await this.createSession(user.id, user.email, activePlatform, context);

      // Send welcome email for new users
      if (isNewUser) {
        this.emailService
          .sendWelcomeEmail(user.email, {
            userName: userData.displayName || user.email,
            loginUrl: `${this.envService.frontendUrl}/login`,
          })
          .catch((err: Error) => this.logger.error(`Failed to send welcome email: ${err.message}`));
      }

      return authResponse;
    });
  }

  // ─── Verify Google ID Token (for SPA/mobile flow) ───────────────────────

  public async verifyGoogleIdToken(idToken: string): Promise<ISsoUserData> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.envService.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    return {
      providerUserId: payload.sub,
      email: payload.email ?? '',
      displayName: payload.name ?? '',
      accessToken: '',
      refreshToken: undefined,
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private async createSession(
    userId: string,
    email: string,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto> {
    // Generate an opaque refresh token; only its SHA-256 is persisted
    const rawRefreshToken = randomBytes(48).toString('base64url');
    const sessionTokenHash = this.sha256(rawRefreshToken);

    const refreshExpirationMs = this.parseDuration(this.envService.jwtRefreshExpiration);
    const expiresAt = new Date(Date.now() + refreshExpirationMs);

    const session = this.uow.userSessions.create({
      userId,
      sessionToken: sessionTokenHash,
      activePlatform,
      deviceId: context.deviceId,
      fingerprint: context.fingerprint,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent,
      expiresAt,
    });
    await this.uow.userSessions.save(session);

    // The JWT role equals the platform — used by RolesGuard and PlatformGuard
    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role: activePlatform,
      activePlatform,
      sessionId: session.id,
      deviceId: context.deviceId,
    };

    const accessExpiresIn = this.envService.jwtAccessExpiration;
    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: this.envService.jwtAccessSecret,
      expiresIn: accessExpiresIn,
    });

    const user = await this.uow.users.findByActiveId(userId);

    if (!user) {
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return plainToInstance(
      AuthResponseDto,
      {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: this.parseDuration(accessExpiresIn) / 1000,
        user: plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true }),
      },
      { excludeExtraneousValues: true },
    );
  }

  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Converts a duration string like '15m', '1h', '7d' to milliseconds.
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }
}
