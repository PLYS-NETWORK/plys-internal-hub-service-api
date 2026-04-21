import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { EMAIL_PROVIDER_TOKEN } from './constants';
import { IEmailProvider } from './interfaces/email-provider.interface';
import {
  IAiDetectedEmailOptions,
  IApplicationStatusEmailOptions,
  IBusinessApplicationNotificationEmailOptions,
  IConsultantApplicationNotificationEmailOptions,
  IForgotPasswordOtpEmailOptions,
  IVerifyRegistrationEmailOptions,
  IWelcomeEmailOptions,
} from './interfaces/email-send-options.interface';
import { IEmailService } from './interfaces/email-service.interface';
import {
  buildBusinessApplicationNotificationEmail,
  buildBusinessForgotPasswordOtpEmail,
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
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: IEmailProvider,
    private readonly requestContext: RequestContextService,
    private readonly env: EnvironmentsService,
  ) {}

  private get rid(): string {
    return this.requestContext.requestId;
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
    this.logger.log(
      `[${this.rid}] sendVerificationEmail — start | to: ${to}, platform: ${platform}`,
    );
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
      this.logger.log(`[${this.rid}] sendVerificationEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendVerificationEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendForgotPasswordOtpEmail(
    to: string,
    options: IForgotPasswordOtpEmailOptions,
    platform: ActivePlatform,
  ): Promise<void> {
    this.logger.log(
      `[${this.rid}] sendForgotPasswordOtpEmail — start | to: ${to}, platform: ${platform}`,
    );
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
      this.logger.log(`[${this.rid}] sendForgotPasswordOtpEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendForgotPasswordOtpEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendWelcomeEmail(
    to: string,
    options: IWelcomeEmailOptions,
    platform: ActivePlatform,
  ): Promise<void> {
    this.logger.log(`[${this.rid}] sendWelcomeEmail — start | to: ${to}, platform: ${platform}`);
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
      this.logger.log(`[${this.rid}] sendWelcomeEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${this.rid}] sendWelcomeEmail — failed | to: ${to} | error: ${message}`);
      throw err;
    }
  }

  public async sendApplicationNotificationToBusinessEmail(
    to: string,
    options: IBusinessApplicationNotificationEmailOptions,
  ): Promise<void> {
    this.logger.log(`[${this.rid}] sendApplicationNotificationToBusinessEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: `New Application: ${options.projectTitle}`,
        html: await buildBusinessApplicationNotificationEmail(options),
      });
      this.logger.log(
        `[${this.rid}] sendApplicationNotificationToBusinessEmail — sent | to: ${to}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendApplicationNotificationToBusinessEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendApplicationNotificationToConsultantEmail(
    to: string,
    options: IConsultantApplicationNotificationEmailOptions,
  ): Promise<void> {
    this.logger.log(
      `[${this.rid}] sendApplicationNotificationToConsultantEmail — start | to: ${to}`,
    );
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: `Application Submitted: ${options.projectTitle}`,
        html: await buildConsultantApplicationNotificationEmail(options),
      });
      this.logger.log(
        `[${this.rid}] sendApplicationNotificationToConsultantEmail — sent | to: ${to}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendApplicationNotificationToConsultantEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendAiDetectedEmail(to: string, options: IAiDetectedEmailOptions): Promise<void> {
    this.logger.log(`[${this.rid}] sendAiDetectedEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendLonaEmail,
        to,
        subject: `Application Review Notice: ${options.projectTitle}`,
        html: await buildConsultantAiDetectedEmail(options),
      });
      this.logger.log(`[${this.rid}] sendAiDetectedEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendAiDetectedEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendApplicationStatusEmail(
    to: string,
    options: IApplicationStatusEmailOptions,
  ): Promise<void> {
    this.logger.log(`[${this.rid}] sendApplicationStatusEmail — start | to: ${to}`);
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
      this.logger.log(`[${this.rid}] sendApplicationStatusEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendApplicationStatusEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendProjectPublishedReceiptEmail(
    to: string,
    options: IBusinessProjectPublishedReceiptTemplateOptions,
  ): Promise<void> {
    this.logger.log(`[${this.rid}] sendProjectPublishedReceiptEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Payment Receipt - Project Published Successfully',
        html: await buildBusinessProjectPublishedReceiptEmail(options),
      });
      this.logger.log(`[${this.rid}] sendProjectPublishedReceiptEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendProjectPublishedReceiptEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }

  public async sendProjectPublishedSuccessEmail(
    to: string,
    options: IBusinessProjectPublishedSuccessTemplateOptions,
  ): Promise<void> {
    this.logger.log(`[${this.rid}] sendProjectPublishedSuccessEmail — start | to: ${to}`);
    try {
      await this.emailProvider.send({
        from: this.env.resendPloyosEmail,
        to,
        subject: 'Your project is officially live',
        html: await buildBusinessProjectPublishedSuccessEmail(options),
      });
      this.logger.log(`[${this.rid}] sendProjectPublishedSuccessEmail — sent | to: ${to}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${this.rid}] sendProjectPublishedSuccessEmail — failed | to: ${to} | error: ${message}`,
      );
      throw err;
    }
  }
}
