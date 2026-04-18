export interface IPaymentConfig {
  readonly paymentProcessor: string;
  readonly polarAccessToken: string;
  readonly polarWebhookSecret: string;
  readonly stripeSecretKey: string;
  readonly stripeWebhookSecret: string;
}
