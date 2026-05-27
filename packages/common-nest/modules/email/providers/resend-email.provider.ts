import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { IEmailMessage } from '@plys/libraries/common-nest/modules/email/interfaces/email-message.interface';
import { IEmailProvider } from '@plys/libraries/common-nest/modules/email/interfaces/email-provider.interface';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Resend } from 'resend';

/**
 * Concrete Strategy: delivers emails via the Resend API.
 *
 * To switch providers (e.g. to SendGrid or SMTP), create a new class
 * implementing IEmailProvider and update the binding in EmailModule.
 * This class — and EmailService — remain untouched.
 */
@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  private readonly logger: AppLogger;
  private readonly client: Resend;

  constructor(
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ResendEmailProvider.name, requestContext);
    this.client = new Resend(this.env.resendApiKey);
  }

  /** @inheritdoc */
  public async send(message: IEmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });

    if (error) {
      this.logger.error(`Failed to send email to ${message.to}: ${error.message}`, error.name);
      throw new InternalServerErrorException('Email delivery failed. Please try again later.');
    }

    this.logger.log(`Email "${message.subject}" delivered to ${message.to}`);
  }
}
