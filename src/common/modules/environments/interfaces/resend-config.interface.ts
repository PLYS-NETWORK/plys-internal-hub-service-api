export interface IResendConfig {
  /** Resend.com API key used to authenticate transactional email requests. */
  readonly resendApiKey: string;

  /** Verified sender address shown in the `From` header of outgoing emails. */
  readonly resendFromEmail: string;
}
