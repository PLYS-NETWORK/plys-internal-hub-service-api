export interface IResendConfig {
  /** Resend.com API key used to authenticate transactional email requests. */
  readonly resendApiKey: string;

  /** Verified sender address for the Ployos (business) brand. */
  readonly resendPloyosEmail: string;

  /** Verified sender address for the Lonaos (consultant) brand. */
  readonly resendLonaosEmail: string;
}
