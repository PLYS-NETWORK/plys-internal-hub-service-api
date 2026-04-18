import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Resend } from 'resend';

import { EnvironmentsService } from '../../environments';
import { IEmailMessage } from '../interfaces/email-message.interface';
import { IEmailProvider } from '../interfaces/email-provider.interface';

/**
 * Concrete Strategy: delivers emails via the Resend API.
 *
 * To switch providers (e.g. to SendGrid or SMTP), create a new class
 * implementing IEmailProvider and update the binding in EmailModule.
 * This class — and EmailService — remain untouched.
 */
@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly client: Resend;
  private readonly fromEmail: string;

  constructor(private readonly env: EnvironmentsService) {
    this.client = new Resend(this.env.resendApiKey);
    this.fromEmail = this.env.resendFromEmail;
  }

  public async send(message: IEmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.fromEmail,
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
