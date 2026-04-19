import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { EMAIL_PROVIDER_TOKEN } from './constants';
import { IEmailProvider } from './interfaces/email-provider.interface';
import {
  IForgotPasswordOtpEmailOptions,
  IVerifyRegistrationEmailOptions,
  IWelcomeEmailOptions,
} from './interfaces/email-send-options.interface';
import { IEmailService } from './interfaces/email-service.interface';
import {
  buildForgotPasswordOtpEmail,
  buildVerifyRegistrationEmail,
  buildWelcomeEmail,
} from './templates';

/**
 * EmailService is the context in the Strategy Pattern.
 * It is completely decoupled from the delivery mechanism — it only knows
 * the IEmailProvider interface. Swapping Resend for another provider
 * requires no changes here.
 */
@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: IEmailProvider,
    private readonly requestContext: RequestContextService,
  ) {}

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /**
   * Sends an account-verification email to a newly registered user.
   * The caller is responsible for generating the verification URL and token.
   */
  public async sendVerificationEmail(
    to: string,
    options: IVerifyRegistrationEmailOptions,
  ): Promise<void> {
    this.logger.log(`[${this.rid}] sendVerificationEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        to,
        subject: 'Verify your email address',
        html: await buildVerifyRegistrationEmail(options),
      });
      this.logger.log(`[${this.rid}] sendVerificationEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendVerificationEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  /**
   * Sends a one-time password to a user who requested a password reset.
   * The caller is responsible for generating and persisting the OTP.
   */
  public async sendForgotPasswordOtpEmail(
    to: string,
    options: IForgotPasswordOtpEmailOptions,
  ): Promise<void> {
    this.logger.log(`[${this.rid}] sendForgotPasswordOtpEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        to,
        subject: 'Your password reset code',
        html: await buildForgotPasswordOtpEmail(options),
      });
      this.logger.log(`[${this.rid}] sendForgotPasswordOtpEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendForgotPasswordOtpEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  /**
   * Sends a welcome email after a user's account is fully activated
   * (post email-verification or first SSO login).
   */
  public async sendWelcomeEmail(to: string, options: IWelcomeEmailOptions): Promise<void> {
    this.logger.log(`[${this.rid}] sendWelcomeEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        to,
        subject: 'Welcome to the Platform!',
        html: await buildWelcomeEmail(options),
      });
      this.logger.log(`[${this.rid}] sendWelcomeEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${this.rid}] sendWelcomeEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }
}
