import { ActivePlatform } from '@database/enums';

import {
  IAiDetectedEmailOptions,
  IApplicationStatusEmailOptions,
  IBusinessApplicationNotificationEmailOptions,
  IConsultantApplicationNotificationEmailOptions,
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
   * Notifies a business user that a consultant has applied to one of their projects.
   *
   * Always sent from the Ployos sender address.
   *
   * @param to      - Business user's email address.
   * @param options - Template variables (e.g. project title, consultant name).
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendApplicationNotificationToBusinessEmail(
    to: string,
    options: IBusinessApplicationNotificationEmailOptions,
  ): Promise<void>;

  /**
   * Confirms to a consultant that their application has been received.
   *
   * Always sent from the Lona sender address.
   *
   * @param to      - Consultant's email address.
   * @param options - Template variables (e.g. project title, application reference).
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendApplicationNotificationToConsultantEmail(
    to: string,
    options: IConsultantApplicationNotificationEmailOptions,
  ): Promise<void>;

  /**
   * Notifies a consultant that their application was flagged by the AI plagiarism detector.
   *
   * Always sent from the Lona sender address.
   *
   * @param to      - Consultant's email address.
   * @param options - Template variables (e.g. project title, flagged content summary).
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendAiDetectedEmail(to: string, options: IAiDetectedEmailOptions): Promise<void>;

  /**
   * Notifies a consultant about a change in the status of their application (approved / rejected).
   *
   * Always sent from the Lona sender address.
   *
   * @param to      - Consultant's email address.
   * @param options - Template variables (e.g. project title, new status, optional reason).
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendApplicationStatusEmail(to: string, options: IApplicationStatusEmailOptions): Promise<void>;

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
