import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { AuthTokenType } from '@database/enums/auth-token-type.enum';
import { SsoProvider } from '@database/enums/sso-provider.enum';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Not } from 'typeorm';

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
    private readonly requestContext: RequestContextService,
  ) {
    this.googleClient = new OAuth2Client(this.envService.googleClientId);
  }

  // ─── Register ────────────────────────────────────────────────────────────

  public async register(dto: RegisterDto, _context: ISessionContext): Promise<void> {
    // Defence-in-depth: the DTO already forbids ADMIN via @IsIn, but guard here
    // too so any internal caller that bypasses the DTO cannot create an admin.
    if (dto.active_platform === ActivePlatform.ADMIN_PLATFORM) {
      throw new TranslatableException({
        messageKey: 'error.auth.admin_self_registration_forbidden',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.FORBIDDEN,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      // Email uniqueness is scoped to (platform, email) — the same email may
      // register independently on BUSINESS and CONSULTANT.
      const existing = await tx.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

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
        platform: dto.active_platform,
        passwordHash,
        isEmailVerified: false,
        isActive: true,
      });
      await tx.users.save(user);

      // Create the minimum viable profile row for the chosen platform so the
      // user can log in and immediately complete onboarding. Only the name is
      // captured here — all other profile fields are filled via the profile
      // module's update/onboard endpoints.
      const displayName = await this.createInitialProfile(tx, user.id, dto);

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
          userName: displayName,
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
    const user = await this.uow.users.findUserByEmailAndPlatform(dto.email, dto.active_platform);

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

    return this.createSession(user.id, user.email, dto.active_platform, context);
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

    const { userId, user } = session;

    // Refresh Token Rotation: delete old session, create fresh one.
    // The platform is re-read from the user (the session no longer carries it).
    await this.uow.userSessions.remove(session);

    return this.createSession(userId, user.email, user.platform, context);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  public async logout(): Promise<void> {
    const sessionId = this.requestContext.sessionId;
    if (sessionId) {
      await this.uow.userSessions.delete({ id: sessionId });
    }
  }

  // ─── Me ──────────────────────────────────────────────────────────────────

  public async me(): Promise<UserResponseDto> {
    const userId = this.requestContext.userId;

    const user = userId ? await this.uow.users.findByActiveId(userId) : null;

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

  public async changePassword(dto: ChangePasswordDto): Promise<void> {
    const userId = this.requestContext.userId;
    const currentSessionId = this.requestContext.sessionId;

    const user = userId ? await this.uow.users.findByActiveId(userId) : null;

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

    const passwordValid = await bcrypt.compare(dto.current_password, user.passwordHash);
    if (!passwordValid) {
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

    // SSO is only available for BUSINESS and CONSULTANT. Admin accounts are
    // provisioned out-of-band and must log in with email/password to guarantee
    // the identity is vetted, not federated through a third-party IdP.
    if (activePlatform === ActivePlatform.ADMIN_PLATFORM) {
      throw new TranslatableException({
        messageKey: 'error.auth.sso_not_allowed_for_platform',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.FORBIDDEN,
      });
    }

    const ssoProvider = provider as SsoProvider;
    const email = userData.email.toLowerCase().trim();

    // Check if this SSO identity is already linked — scoped by platform so the
    // same Google account may independently link a Business and a Consultant user.
    const existingLink = await this.uow.userSsoProviders.findOne({
      where: {
        platform: activePlatform,
        provider: ssoProvider,
        providerUserId: userData.providerUserId,
      },
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

    // SSO identity not linked yet — match or create a user on this platform.
    return this.uow.withTransaction(async (tx) => {
      let user = await tx.users.findUserByEmailAndPlatform(email, activePlatform);
      let isNewUser = false;

      if (!user) {
        // New account on this platform — SSO confirms email ownership so the
        // user is auto-verified. A minimal profile is created so the user can
        // complete onboarding immediately after first login.
        user = tx.users.create({
          email,
          platform: activePlatform,
          passwordHash: null,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          isActive: true,
          lastLoginAt: new Date(),
        });
        await tx.users.save(user);

        await this.createInitialProfile(tx, user.id, {
          active_platform: activePlatform,
          // Use the SSO-provided display name for both platforms; the user can
          // rename it later via the profile module.
          company_name: userData.displayName || email,
          full_name: userData.displayName || email,
        });

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

      // Link the SSO provider to the user on this specific platform
      const ssoLink = tx.userSsoProviders.create({
        userId: user.id,
        platform: activePlatform,
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

  /**
   * Creates the minimum-viable profile row for the user's platform.
   * - BUSINESS   → `business_profiles` with `company_name`
   * - CONSULTANT → `consultant_profiles` with `full_name`
   * - ADMIN      → no profile row (admins have no consumer-facing profile)
   *
   * Returns the display name for downstream use (email greeting, etc.).
   */
  private async createInitialProfile(
    tx: IUnitOfWork,
    userId: string,
    dto: Pick<RegisterDto, 'active_platform' | 'company_name' | 'full_name'>,
  ): Promise<string> {
    if (dto.active_platform === ActivePlatform.BUSINESS) {
      const companyName = dto.company_name!;
      const profile = tx.businessProfiles.create({
        userId,
        companyName,
        isVerified: false,
      });
      await tx.businessProfiles.save(profile);
      return companyName;
    }

    if (dto.active_platform === ActivePlatform.CONSULTANT) {
      const fullName = dto.full_name!;
      const profile = tx.consultantProfiles.create({
        userId,
        fullName,
        isVerified: false,
      });
      await tx.consultantProfiles.save(profile);
      return fullName;
    }

    // ADMIN — no profile row; fall back to a generic greeting.
    return 'Admin';
  }

  private async createSession(
    userId: string,
    email: string,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto> {
    // Fetch user first so role is available for the JWT payload
    const user = await this.uow.users.findByActiveId(userId);

    if (!user) {
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Generate an opaque refresh token; only its SHA-256 is persisted
    const rawRefreshToken = randomBytes(48).toString('base64url');
    const sessionTokenHash = this.sha256(rawRefreshToken);

    const refreshExpirationMs = this.parseDuration(this.envService.jwtRefreshExpiration);
    const expiresAt = new Date(Date.now() + refreshExpirationMs);

    const session = this.uow.userSessions.create({
      userId,
      sessionToken: sessionTokenHash,
      deviceId: context.deviceId,
      fingerprint: context.fingerprint,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent,
      expiresAt,
    });
    await this.uow.userSessions.save(session);

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role: user.role,
      activePlatform,
      sessionId: session.id,
      deviceId: context.deviceId,
    };

    const accessExpiresIn = this.envService.jwtAccessExpiration;
    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: this.envService.jwtAccessSecret,
      expiresIn: accessExpiresIn,
    });

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
