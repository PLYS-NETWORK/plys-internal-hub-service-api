import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform, SsoProvider } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { AuthResponseDto } from '../dto/responses/auth-response.dto';
import {
  ISessionContext,
  ISsoAuthService,
  ISsoUserData,
} from '../interfaces/auth-service.interface';
import {
  ISsoTokenProvider,
  SSO_PROVIDERS_TOKEN,
} from '../providers/interfaces/sso-provider.interface';
import { SessionService } from './session.service';
import { UserOnboardingService } from './user-onboarding.service';

@Injectable()
export class SsoAuthService implements ISsoAuthService {
  private readonly logger: AppLogger;

  /** Map built once at construction for O(1) provider lookup by name. */
  private readonly providerMap: Map<SsoProvider, ISsoTokenProvider>;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly emailService: EmailService,
    private readonly sessionService: SessionService,
    private readonly onboardingService: UserOnboardingService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
    @Inject(SSO_PROVIDERS_TOKEN) providers: ISsoTokenProvider[],
  ) {
    this.logger = new AppLogger(SsoAuthService.name, requestContext);
    this.providerMap = new Map(providers.map((p) => [p.providerName, p]));
  }

  public async ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto> {
    this.logger.log(
      `ssoLogin — start | provider: ${provider}, platform: ${activePlatform}, email: ${userData.email}`,
    );

    if (!userData.email) {
      this.logger.warn(`ssoLogin — SSO provider returned no email | provider: ${provider}`);
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
      this.logger.warn(`ssoLogin — SSO not allowed for admin platform`);
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
        this.logger.warn(`ssoLogin — account inactive | userId: ${user.id}`);
        throw new TranslatableException({
          messageKey: 'error.auth.account_inactive',
          errorCode: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
          status: HttpStatus.FORBIDDEN,
          details: user.banReason ? { ban_reason: user.banReason } : undefined,
        });
      }

      // Consultant-only: refuse SSO sign-in while the onboarding rejection block is active.
      await this.assertConsultantNotBlocked(user.id, activePlatform);

      // Update SSO tokens
      existingLink.accessToken = userData.accessToken;
      existingLink.refreshToken = userData.refreshToken ?? null;
      await this.uow.userSsoProviders.save(existingLink);

      user.lastLoginAt = new Date();
      await this.uow.users.save(user);

      this.logger.log(`ssoLogin — existing link, session created | userId: ${user.id}`);
      return this.sessionService.createSession(user.id, user.email, activePlatform, context);
    }

    // SSO identity not linked yet — match or create a user on this platform.
    const authResponse = await this.uow.withTransaction(async (tx) => {
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
          emailVerifiedAt: new Date(),
          isActive: true,
          lastLoginAt: new Date(),
        });
        await tx.users.save(user);
        // TypeORM may omit boolean columns with @Column({ default: false }) from the
        // INSERT. Explicit UPDATE guarantees is_email_verified = true is written.
        await tx.users.update(user.id, { isEmailVerified: true });
        user = (await tx.users.findOneBy({ id: user.id }))!;

        await this.onboardingService.createInitialProfile(tx, user.id, {
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
            details: user.banReason ? { ban_reason: user.banReason } : undefined,
          });
        }

        // A consultant whose latest onboarding was REJECTED must not be allowed
        // back in through SSO during the 3-month block window.
        await this.assertConsultantNotBlocked(user.id, activePlatform, tx);

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

      // Awaited inside the transaction: if delivery fails the entire transaction
      // rolls back, the user and SSO-link rows are removed, and the API returns
      // an error so the caller knows to retry.
      if (isNewUser) {
        let dashboardUrl =
          activePlatform === ActivePlatform.CONSULTANT
            ? `${this.envService.lonaUrl}/dashboard`
            : this.envService.ployosUrl;

        // For business users, try to get business profile ID for proper dashboard URL
        if (activePlatform === ActivePlatform.BUSINESS) {
          try {
            const businessProfile = await this.uow.businessProfiles.findOne({
              where: { userId: user.id },
            });

            if (businessProfile) {
              dashboardUrl += `/overview`;
            } else {
              dashboardUrl += '/dashboard';
            }
          } catch {
            dashboardUrl += '/dashboard';
          }
        }

        await this.emailService.sendWelcomeEmail(
          user.email,
          { userName: userData.displayName || user.email, dashboardUrl },
          activePlatform,
        );
      }

      this.logger.log(`ssoLogin — complete | userId: ${user.id}, isNewUser: ${isNewUser}`);
      return this.sessionService.createSession(user.id, user.email, activePlatform, context);
    });

    return authResponse;
  }

  /**
   * Resolves the registered ISsoTokenProvider for the given provider name and
   * delegates token verification to it. Throws if the provider is not
   * registered (e.g. Google OAuth not configured).
   */
  public async verifyProviderToken(
    providerName: SsoProvider,
    idToken: string,
  ): Promise<ISsoUserData> {
    this.logger.log(`verifyProviderToken — start | provider: ${providerName}`);

    const provider = this.providerMap.get(providerName);
    if (!provider) {
      this.logger.error(
        `verifyProviderToken — provider not configured | provider: ${providerName}`,
      );
      throw new TranslatableException({
        messageKey: 'error.auth.sso_not_allowed_for_platform',
        errorCode: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }

    const result = await provider.verifyToken(idToken);
    this.logger.log(`verifyProviderToken — complete | provider: ${providerName}`);
    return result;
  }

  /**
   * For CONSULTANT SSO logins: if the user has an onboarding row with an
   * active block (`blocked_until > now` from a prior admin REJECT), refuse
   * sign-in with `CONSULTANT_ONBOARDING_BLOCKED`. No-op for other platforms.
   *
   * `tx` is passed when the check happens inside the SSO-link transaction so
   * the read joins the same query runner; for already-linked users the
   * top-level UoW is used.
   */
  private async assertConsultantNotBlocked(
    userId: string,
    activePlatform: ActivePlatform,
    tx?: { consultantOnboardings: UnitOfWorkService['consultantOnboardings'] },
  ): Promise<void> {
    if (activePlatform !== ActivePlatform.CONSULTANT) return;
    const repo = (tx ?? this.uow).consultantOnboardings;
    const onboarding = await repo.findByUserId(userId);
    if (onboarding?.blockedUntil && onboarding.blockedUntil > new Date()) {
      this.logger.warn(
        `ssoLogin — consultant blocked | userId: ${userId} | until: ${onboarding.blockedUntil.toISOString()}`,
      );
      throw new TranslatableException({
        messageKey: 'error.consultant_onboarding.blocked',
        errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_BLOCKED,
        status: HttpStatus.FORBIDDEN,
        details: { blocked_until: onboarding.blockedUntil.toISOString() },
      });
    }
  }
}
