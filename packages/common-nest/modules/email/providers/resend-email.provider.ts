import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
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
      throw new TranslatableException({
        messageKey: 'error.generic.email_delivery_failed',
        errorCode: ERROR_CODES.EMAIL_DELIVERY_FAILED,
        status: HttpStatus.BAD_GATEWAY,
        details: { provider: 'resend', reason: error.message },
      });
    }

    this.logger.log(`Email "${message.subject}" delivered to ${message.to}`);
  }
}
