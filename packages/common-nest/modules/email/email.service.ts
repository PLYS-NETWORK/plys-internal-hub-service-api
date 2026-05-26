import { Inject, Injectable } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform } from '@plys/libraries/database/enums';

import { EMAIL_PROVIDER_TOKEN } from './constants';
import { IEmailProvider } from './interfaces/email-provider.interface';
import {
  IAdminInviteEmailOptions,
  IAdminNewConsultantApplicationEmailOptions,
  IAdminOtpEmailOptions,
  IApplicationApprovedEmailOptions,
  IApplicationRejectedEmailOptions,
  IApplicationSubmittedEmailOptions,
  IForgotPasswordOtpEmailOptions,
  IInterviewReadyEmailOptions,
  IMonthlyInvoiceEmailOptions,
  IVerifyRegistrationEmailOptions,
  IWelcomeEmailOptions,
} from './interfaces/email-send-options.interface';
import { IEmailService } from './interfaces/email-service.interface';
import {
  buildAdminInviteEmail,
  buildAdminNewConsultantApplicationEmail,
  buildAdminOtpEmail,
  buildBusinessForgotPasswordOtpEmail,
  buildBusinessMonthlyInvoiceEmail,
  buildBusinessProjectPublishedReceiptEmail,
  buildBusinessProjectPublishedSuccessEmail,
  buildBusinessProjectRepublishRefundEmail,
  buildBusinessVerifyRegistrationEmail,
  buildBusinessWelcomeEmail,
  buildConsultantApplicationApprovedEmail,
  buildConsultantApplicationRejectedEmail,
  buildConsultantApplicationSubmittedEmail,
  buildConsultantForgotPasswordOtpEmail,
  buildConsultantInterviewReadyEmail,
  buildConsultantVerifyRegistrationEmail,
  buildConsultantWelcomeEmail,
  buildTopUpCancelledEmail,
  buildWithdrawCancelledEmail,
  type IBusinessMonthlyInvoiceTemplateOptions,
  type IBusinessProjectPublishedReceiptTemplateOptions,
  type IBusinessProjectPublishedSuccessTemplateOptions,
  type IBusinessProjectRepublishRefundTemplateOptions,
  type ITopUpCancelledTemplateOptions,
  type IWithdrawCancelledTemplateOptions,
} from './templates';

/**
 * EmailService is the context in the Strategy Pattern.
 * It is completely decoupled from the delivery mechanism — it only knows
 * the IEmailProvider interface. Swapping Resend for another provider
 * requires no changes here.
 */
@Injectable()
export class EmailService implements IEmailService {
  private readonly logger: AppLogger;

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: IEmailProvider,
    private readonly requestContext: RequestContextService,
    private readonly env: EnvironmentsService,
  ) {
    this.logger = new AppLogger(EmailService.name, requestContext);
  }

  private fromEmailForPlatform(platform: ActivePlatform): string {
    return platform === ActivePlatform.CONSULTANT
      ? this.env.resendLonaEmail
      : this.env.resendPloyosEmail;
  }

  /** @inheritdoc */
  public async sendVerificationEmail(
    to: string,
    options: IVerifyRegistrationEmailOptions,
    platform: ActivePlatform,
  ): Promise<void> {
    this.logger.log(`sendVerificationEmail — start | to: ${to}, platform: ${platform}`);
    try {
      const html =
        platform === ActivePlatform.CONSULTANT
          ? await buildConsultantVerifyRegistrationEmail(options)
          : await buildBusinessVerifyRegistrationEmail(options);

      await this.emailProvider.send({
        from: this.fromEmailForPlatform(platform),
        to,
        subject: 'Verify your email address',
        html,
      });
      this.logger.log(`sendVerificationEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendVerificationEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendForgotPasswordOtpEmail(
    to: string,
    options: IForgotPasswordOtpEmailOptions,
    platform: ActivePlatform,
  ): Promise<void> {
    this.logger.log(`sendForgotPasswordOtpEmail — start | to: ${to}, platform: ${platform}`);
    try {
      const html =
        platform === ActivePlatform.CONSULTANT
          ? await buildConsultantForgotPasswordOtpEmail(options)
          : await buildBusinessForgotPasswordOtpEmail(options);

      await this.emailProvider.send({
        from: this.fromEmailForPlatform(platform),
        to,
        subject: 'Your password reset code',
        html,
      });
      this.logger.log(`sendForgotPasswordOtpEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendForgotPasswordOtpEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendAdminOtpEmail(to: string, options: IAdminOtpEmailOptions): Promise<void> {
    this.logger.log(`sendAdminOtpEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Your Admin Hub login code',
        html: await buildAdminOtpEmail(options),
      });
      this.logger.log(`sendAdminOtpEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendAdminOtpEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendAdminInviteEmail(to: string, options: IAdminInviteEmailOptions): Promise<void> {
    this.logger.log(`sendAdminInviteEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: "You're invited to the Admin Hub",
        html: await buildAdminInviteEmail(options),
      });
      this.logger.log(`sendAdminInviteEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendAdminInviteEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendWelcomeEmail(
    to: string,
    options: IWelcomeEmailOptions,
    platform: ActivePlatform,
  ): Promise<void> {
    this.logger.log(`sendWelcomeEmail — start | to: ${to}, platform: ${platform}`);
    try {
      const html =
        platform === ActivePlatform.CONSULTANT
          ? await buildConsultantWelcomeEmail(options)
          : await buildBusinessWelcomeEmail(options);

      await this.emailProvider.send({
        from: this.fromEmailForPlatform(platform),
        to,
        subject: platform === ActivePlatform.CONSULTANT ? 'Welcome to Lona!' : 'Welcome to Ployos!',
        html,
      });
      this.logger.log(`sendWelcomeEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendWelcomeEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  public async sendProjectPublishedReceiptEmail(
    to: string,
    options: IBusinessProjectPublishedReceiptTemplateOptions,
  ): Promise<void> {
    this.logger.log(`sendProjectPublishedReceiptEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Payment Receipt - Project Published Successfully',
        html: await buildBusinessProjectPublishedReceiptEmail(options),
      });
      this.logger.log(`sendProjectPublishedReceiptEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `sendProjectPublishedReceiptEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendProjectPublishedSuccessEmail(
    to: string,
    options: IBusinessProjectPublishedSuccessTemplateOptions,
  ): Promise<void> {
    this.logger.log(`sendProjectPublishedSuccessEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Your project is officially live',
        html: await buildBusinessProjectPublishedSuccessEmail(options),
      });
      this.logger.log(`sendProjectPublishedSuccessEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `sendProjectPublishedSuccessEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendProjectRepublishRefundEmail(
    to: string,
    options: IBusinessProjectRepublishRefundTemplateOptions,
  ): Promise<void> {
    this.logger.log(`sendProjectRepublishRefundEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Refund Issued - Project Reverted for Re-publish',
        html: await buildBusinessProjectRepublishRefundEmail(options),
      });
      this.logger.log(`sendProjectRepublishRefundEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendProjectRepublishRefundEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  public async sendTopUpCancelledEmail(
    to: string,
    options: ITopUpCancelledTemplateOptions,
  ): Promise<void> {
    this.logger.log(`sendTopUpCancelledEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Top-Up Cancelled — No Charge Made',
        html: await buildTopUpCancelledEmail(options),
      });
      this.logger.log(`sendTopUpCancelledEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendTopUpCancelledEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  public async sendWithdrawCancelledEmail(
    to: string,
    options: IWithdrawCancelledTemplateOptions,
  ): Promise<void> {
    this.logger.log(`sendWithdrawCancelledEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Withdrawal Cancelled — Amount Restored',
        html: await buildWithdrawCancelledEmail(options),
      });
      this.logger.log(`sendWithdrawCancelledEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendWithdrawCancelledEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendMonthlyInvoiceEmail(
    to: string,
    options: IMonthlyInvoiceEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendMonthlyInvoiceEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: `Monthly Invoice - ${options.billingPeriod}`,
        html: await buildBusinessMonthlyInvoiceEmail(
          options as IBusinessMonthlyInvoiceTemplateOptions,
        ),
      });
      this.logger.log(`sendMonthlyInvoiceEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendMonthlyInvoiceEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendInterviewReadyEmail(
    to: string,
    options: IInterviewReadyEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendInterviewReadyEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: 'Your interview questions are ready',
        html: await buildConsultantInterviewReadyEmail(options),
      });
      this.logger.log(`sendInterviewReadyEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendInterviewReadyEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendApplicationSubmittedEmail(
    to: string,
    options: IApplicationSubmittedEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendApplicationSubmittedEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: 'Interview submitted — we are reviewing your application',
        html: await buildConsultantApplicationSubmittedEmail(options),
      });
      this.logger.log(`sendApplicationSubmittedEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendApplicationSubmittedEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendApplicationApprovedEmail(
    to: string,
    options: IApplicationApprovedEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendApplicationApprovedEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: 'Congratulations — your application has been approved!',
        html: await buildConsultantApplicationApprovedEmail(options),
      });
      this.logger.log(`sendApplicationApprovedEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendApplicationApprovedEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendApplicationRejectedEmail(
    to: string,
    options: IApplicationRejectedEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendApplicationRejectedEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: 'Update on your application',
        html: await buildConsultantApplicationRejectedEmail(options),
      });
      this.logger.log(`sendApplicationRejectedEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendApplicationRejectedEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  /** @inheritdoc */
  public async sendAdminNewApplicationEmail(
    recipients: string[],
    options: IAdminNewConsultantApplicationEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendAdminNewApplicationEmail — start | recipients: ${recipients.length}`);
    try {
      const html = await buildAdminNewConsultantApplicationEmail(options);
      await Promise.all(
        recipients.map((to) =>
          this.emailProvider.send({
            from: this.env.resendPloyosEmail,
            to,
            subject: `New consultant application — ${options.consultantName}`,
            html,
          }),
        ),
      );
      this.logger.log(`sendAdminNewApplicationEmail — sent | recipients: ${recipients.length}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendAdminNewApplicationEmail — failed | error: ${message}`);
      throw err;
    }
  }
}
