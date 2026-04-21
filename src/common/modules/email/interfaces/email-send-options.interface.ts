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

export interface IBusinessApplicationNotificationEmailOptions {
  /** Business owner's company name. */
  readonly recipientName: string;
  readonly projectTitle: string;
  readonly consultantFullName: string;
  /** Translated skill names that matched. */
  readonly matchedSkills: string[];
  /** Formatted consultant address string. */
  readonly consultantAddress: string;
  /** Link to review the application on the Ployos platform. */
  readonly applicationUrl: string;
}

export interface IConsultantApplicationNotificationEmailOptions {
  /** Consultant's full name. */
  readonly recipientName: string;
  readonly projectTitle: string;
  readonly consultantFullName: string;
  /** Translated skill names that matched. */
  readonly matchedSkills: string[];
  /** Formatted consultant address string. */
  readonly consultantAddress: string;
}

export interface IAiDetectedEmailOptions {
  readonly userName: string;
  readonly projectTitle: string;
}

export interface IApplicationStatusEmailOptions {
  readonly consultantName: string;
  readonly projectTitle: string;
  readonly status: 'approved' | 'rejected';
  /** Only provided when status is 'rejected'. */
  readonly rejectionReason?: string;
  /** Link to the project on the consultant platform. Only for approved. */
  readonly projectUrl?: string;
}

export interface IMonthlyInvoiceEmailOptions {
  readonly businessName: string;
  readonly invoiceNumber: string;
  readonly billingPeriod: string;
  readonly dueDate: string;
  readonly taskTotal: string;
  readonly commissionAmount: string;
  readonly invoiceTotal: string;
  readonly lineItems: ReadonlyArray<{ readonly taskName: string; readonly amount: string }>;
  readonly payInvoiceUrl: string;
}
