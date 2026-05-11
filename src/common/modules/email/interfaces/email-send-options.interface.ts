import type { ContactTopic } from '@database/entities/contact/contact-inquiry.entity';

export interface IAdminOtpEmailOptions {
  readonly otp: string;
  /** Expiry duration shown in the email copy. Defaults to 10 minutes. */
  readonly expiryMinutes?: number;
}

export interface IAdminInviteEmailOptions {
  /** URL the CTA button points to (env `INTERNAL_HUB_URL`). */
  readonly internalHubUrl: string;
  /** Email of the admin who issued the invite, surfaced in the email copy. */
  readonly invitedByEmail?: string;
}

export interface IVerifyRegistrationEmailOptions {
  readonly userName: string;
  readonly verificationUrl: string;
  /** Expiry duration shown in the email copy. Defaults to 24 hours. */
  readonly expiryHours?: number;
}

export interface IForgotPasswordOtpEmailOptions {
  readonly userName: string;
  readonly otp: string;
  /** Expiry duration shown in the email copy. Defaults to 10 minutes. */
  readonly expiryMinutes?: number;
}

export interface IWelcomeEmailOptions {
  readonly userName: string;
  readonly dashboardUrl: string;
}

export interface IMonthlyInvoiceEmailOptions {
  readonly businessName: string;
  readonly transactionNumber: string;
  readonly billingPeriod: string;
  readonly dueDate: string;
  readonly taskTotal: string;
  readonly commissionAmount: string;
  readonly invoiceTotal: string;
  readonly lineItems: ReadonlyArray<{ readonly taskName: string; readonly amount: string }>;
  readonly payInvoiceUrl: string;
}

export interface IInterviewReadyEmailOptions {
  readonly userName: string;
  readonly interviewUrl: string;
}

export interface IApplicationSubmittedEmailOptions {
  readonly userName: string;
}

export interface IApplicationApprovedEmailOptions {
  readonly userName: string;
  readonly dashboardUrl: string;
}

export interface IApplicationRejectedEmailOptions {
  readonly userName: string;
  readonly reason: string;
  readonly blockedUntil: string;
}

export interface IAdminNewConsultantApplicationEmailOptions {
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly submittedAt: string;
  readonly reviewUrl: string;
}

export interface IContactInquiryNotificationEmailOptions {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly topic: ContactTopic;
  readonly message: string;
  readonly submittedAt: Date;
  readonly ipAddress: string | null;
}

export interface IContactInquiryAcknowledgementEmailOptions {
  readonly name: string;
  readonly topic: ContactTopic;
}
