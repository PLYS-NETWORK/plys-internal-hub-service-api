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
