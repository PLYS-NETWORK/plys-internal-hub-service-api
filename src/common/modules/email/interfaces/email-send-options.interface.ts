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
  readonly loginUrl: string;
}

export interface IApplicationNotificationEmailOptions {
  /** Recipient name (business company name or consultant full name). */
  readonly recipientName: string;
  readonly projectTitle: string;
  readonly consultantFullName: string;
  /** Translated skill names that matched. */
  readonly matchedSkills: string[];
  /** Formatted consultant address string. */
  readonly consultantAddress: string;
  /** Link to view the application on the business platform. Only provided for business recipients. */
  readonly applicationUrl?: string;
}

export interface IAiDetectedEmailOptions {
  readonly userName: string;
  readonly projectTitle: string;
}
