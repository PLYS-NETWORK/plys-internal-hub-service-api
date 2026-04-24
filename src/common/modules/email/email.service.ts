import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums';
import { Inject, Injectable } from '@nestjs/common';

import { EMAIL_PROVIDER_TOKEN } from './constants';
import { IEmailProvider } from './interfaces/email-provider.interface';
import {
  IAiDetectedEmailOptions,
  IApplicationStatusEmailOptions,
  IBusinessApplicationNotificationEmailOptions,
  IConsultantApplicationNotificationEmailOptions,
  IForgotPasswordOtpEmailOptions,
  IMonthlyInvoiceEmailOptions,
  IVerifyRegistrationEmailOptions,
  IWelcomeEmailOptions,
} from './interfaces/email-send-options.interface';
import { IEmailService } from './interfaces/email-service.interface';
import {
  buildBusinessApplicationNotificationEmail,
  buildBusinessForgotPasswordOtpEmail,
  buildBusinessMonthlyInvoiceEmail,
  buildBusinessProjectPublishedReceiptEmail,
  buildBusinessProjectPublishedSuccessEmail,
  buildBusinessVerifyRegistrationEmail,
  buildBusinessWelcomeEmail,
  buildConsultantAiDetectedEmail,
  buildConsultantApplicationNotificationEmail,
  buildConsultantApplicationStatusEmail,
  buildConsultantForgotPasswordOtpEmail,
  buildConsultantVerifyRegistrationEmail,
  buildConsultantWelcomeEmail,
  type IBusinessMonthlyInvoiceTemplateOptions,
  type IBusinessProjectPublishedReceiptTemplateOptions,
  type IBusinessProjectPublishedSuccessTemplateOptions,
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

  public async sendApplicationNotificationToBusinessEmail(
    to: string,
    options: IBusinessApplicationNotificationEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendApplicationNotificationToBusinessEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: `New Application: ${options.projectTitle}`,
        html: await buildBusinessApplicationNotificationEmail(options),
      });
      this.logger.log(`sendApplicationNotificationToBusinessEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `sendApplicationNotificationToBusinessEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendApplicationNotificationToConsultantEmail(
    to: string,
    options: IConsultantApplicationNotificationEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendApplicationNotificationToConsultantEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: `Application Submitted: ${options.projectTitle}`,
        html: await buildConsultantApplicationNotificationEmail(options),
      });
      this.logger.log(`sendApplicationNotificationToConsultantEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `sendApplicationNotificationToConsultantEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendAiDetectedEmail(to: string, options: IAiDetectedEmailOptions): Promise<void> {
    this.logger.log(`sendAiDetectedEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: `Application Review Notice: ${options.projectTitle}`,
        html: await buildConsultantAiDetectedEmail(options),
      });
      this.logger.log(`sendAiDetectedEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendAiDetectedEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  public async sendApplicationStatusEmail(
    to: string,
    options: IApplicationStatusEmailOptions,
  ): Promise<void> {
    this.logger.log(`sendApplicationStatusEmail — start | to: ${to}`);
    const subject =
      options.status === 'approved'
        ? `Application Approved: ${options.projectTitle}`
        : `Application Update: ${options.projectTitle}`;
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject,
        html: await buildConsultantApplicationStatusEmail(options),
      });
      this.logger.log(`sendApplicationStatusEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sendApplicationStatusEmail — failed | to: ${to} | error: ${message}`);
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
}
