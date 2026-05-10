import { ActivePlatform } from '@database/enums';

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
} from './email-send-options.interface';

export interface IEmailService {
  /**
   * Sends a one-time login OTP to an admin user for the Admin Hub.
   *
   * Always sent from the platform admin sender address.
   *
   * @param to      - Recipient admin email address.
   * @param options - Template variables (OTP code, expiry minutes).
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendAdminOtpEmail(to: string, options: IAdminOtpEmailOptions): Promise<void>;

  /**
   * Sends an Admin Hub invitation email to a freshly allow-listed address.
   * The CTA points to `INTERNAL_HUB_URL`. The recipient still authenticates
   * through the existing OTP flow — this email is informational only.
   *
   * @param to      - Recipient admin email address.
   * @param options - Template variables (`internalHubUrl`, optional `invitedByEmail`).
   * @returns Resolves when the email has been handed off to the delivery provider.
   * @throws InternalServerErrorException — if the delivery provider returns an error.
   */
  sendAdminInviteEmail(to: string, options: IAdminInviteEmailOptions): Promise<void>;
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

  /**
   * Sends an email to a consultant when their interview questions are ready.
   * @param to      - Consultant email address.
   * @param options - Template variables (userName, interviewUrl).
   */
  sendInterviewReadyEmail(to: string, options: IInterviewReadyEmailOptions): Promise<void>;

  /**
   * Sends a confirmation to a consultant after they submit their interview.
   * @param to      - Consultant email address.
   * @param options - Template variables (userName).
   */
  sendApplicationSubmittedEmail(
    to: string,
    options: IApplicationSubmittedEmailOptions,
  ): Promise<void>;

  /**
   * Sends an approval notification to a consultant.
   * @param to      - Consultant email address.
   * @param options - Template variables (userName, dashboardUrl).
   */
  sendApplicationApprovedEmail(
    to: string,
    options: IApplicationApprovedEmailOptions,
  ): Promise<void>;

  /**
   * Sends a rejection notification to a consultant with block duration.
   * @param to      - Consultant email address.
   * @param options - Template variables (userName, reason, blockedUntil).
   */
  sendApplicationRejectedEmail(
    to: string,
    options: IApplicationRejectedEmailOptions,
  ): Promise<void>;

  /**
   * Sends a new-application notification to all active admin email addresses.
   * @param recipients - Array of active admin email addresses.
   * @param options    - Template variables (consultantName, consultantEmail, submittedAt, reviewUrl).
   */
  sendAdminNewApplicationEmail(
    recipients: string[],
    options: IAdminNewConsultantApplicationEmailOptions,
  ): Promise<void>;
}
