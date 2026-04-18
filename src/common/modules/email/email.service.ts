import { Inject, Injectable, Logger } from '@nestjs/common';

import { EMAIL_PROVIDER_TOKEN } from './constants';
import { IEmailProvider } from './interfaces/email-provider.interface';
import {
  IForgotPasswordOtpEmailOptions,
  IVerifyRegistrationEmailOptions,
} from './interfaces/email-send-options.interface';
import { buildForgotPasswordOtpEmail, buildVerifyRegistrationEmail } from './templates';

/**
 * EmailService is the context in the Strategy Pattern.
 * It is completely decoupled from the delivery mechanism — it only knows
 * the IEmailProvider interface. Swapping Resend for another provider
 * requires no changes here.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: IEmailProvider,
  ) {}

  /**
   * Sends an account-verification email to a newly registered user.
   * The caller is responsible for generating the verification URL and token.
   */
  public async sendVerificationEmail(
    to: string,
    options: IVerifyRegistrationEmailOptions,
  ): Promise<void> {
    this.logger.log(`Sending verification email to ${to}`);

    await this.emailProvider.send({
      to,
      subject: 'Verify your email address',
      html: await buildVerifyRegistrationEmail(options),
    });
  }

  /**
   * Sends a one-time password to a user who requested a password reset.
   * The caller is responsible for generating and persisting the OTP.
   */
  public async sendForgotPasswordOtpEmail(
    to: string,
    options: IForgotPasswordOtpEmailOptions,
  ): Promise<void> {
    this.logger.log(`Sending forgot-password OTP email to ${to}`);

    await this.emailProvider.send({
      to,
      subject: 'Your password reset code',
      html: await buildForgotPasswordOtpEmail(options),
    });
  }
}
