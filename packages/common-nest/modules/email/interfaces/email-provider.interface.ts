import { IEmailMessage } from './email-message.interface';

/**
 * Strategy interface for email delivery.
 *
 * Any concrete provider (Resend, SendGrid, SMTP, etc.) must implement
 * this contract. Swapping providers requires only:
 *   1. A new class implementing IEmailProvider
 *   2. Changing the binding in EmailModule — EmailService is untouched.
 */
export interface IEmailProvider {
  send(message: IEmailMessage): Promise<void>;
}
