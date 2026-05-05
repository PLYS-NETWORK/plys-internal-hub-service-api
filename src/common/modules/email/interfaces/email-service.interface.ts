import { ActivePlatform } from '@database/enums';

import {
  IForgotPasswordOtpEmailOptions,
  IMonthlyInvoiceEmailOptions,
  IVerifyRegistrationEmailOptions,
  IWelcomeEmailOptions,
} from './email-send-options.interface';

export interface IEmailService {
  /**
   * Sends an email verification / registration confirmation email to the given address.
   *
   * The template is selected based on `platform` — Lona for CONSULTANT, Ployos for BUSINESS.
   *
   * @param to       - Recipient email address.
   * @param options  - Template variables (e.g. OTP code, user name).
   * @param platform - Determines which branded template and sender address to use.
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendVerificationEmail(
    to: string,
    options: IVerifyRegistrationEmailOptions,
    platform: ActivePlatform,
  ): Promise<void>;

  /**
   * Sends a forgot-password OTP email to the given address.
   *
   * The template is selected based on `platform` — Lona for CONSULTANT, Ployos for BUSINESS.
   *
   * @param to       - Recipient email address.
   * @param options  - Template variables (e.g. OTP code, expiry minutes).
   * @param platform - Determines which branded template and sender address to use.
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendForgotPasswordOtpEmail(
    to: string,
    options: IForgotPasswordOtpEmailOptions,
    platform: ActivePlatform,
  ): Promise<void>;

  /**
   * Sends a welcome email to a newly registered user.
   *
   * The template is selected based on `platform` — Lona for CONSULTANT, Ployos for BUSINESS.
   *
   * @param to       - Recipient email address.
   * @param options  - Template variables (e.g. first name, login URL).
   * @param platform - Determines which branded template and sender address to use.
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendWelcomeEmail(
    to: string,
    options: IWelcomeEmailOptions,
    platform: ActivePlatform,
  ): Promise<void>;

  /**
   * Sends a monthly invoice summary email to a business user.
   *
   * Always sent from the Ployos sender address.
   *
   * @param to      - Business user's email address.
   * @param options - Template variables (e.g. billing period label, invoice amount, line items).
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendMonthlyInvoiceEmail(to: string, options: IMonthlyInvoiceEmailOptions): Promise<void>;
}
