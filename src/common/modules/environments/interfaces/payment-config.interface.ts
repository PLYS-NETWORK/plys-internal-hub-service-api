export interface IPaymentConfig {
  /**
   * Active payment provider identifier (`'polar'` or `'stripe'`).
   * Determines which provider the `PaymentProviderRegistry` instantiates at startup.
   */
  readonly paymentProcessor: string;

  /** Polar.sh API access token. Only read when `paymentProcessor === 'polar'`. */
  readonly polarAccessToken: string;

  /**
   * Polar API environment. Use `'sandbox'` for sandbox.polar.sh tokens and
   * `'production'` for live polar.sh tokens. Must match the token's origin —
   * mismatching causes 401 `invalid_token` from the Polar API.
   */
  readonly polarServer: 'sandbox' | 'production';

  /** Polar.sh webhook signing secret used to verify incoming webhook payloads. */
  readonly polarWebhookSecret: string;

  /** Polar.sh pre-created product ID for invoice payments. */
  readonly polarInvoiceProductId: string;

  /** Stripe secret key (`sk_live_*` or `sk_test_*`). Only read when `paymentProcessor === 'stripe'`. */
  readonly stripeSecretKey: string;

  /** Stripe webhook signing secret (`whsec_*`) used to verify incoming webhook payloads. */
  readonly stripeWebhookSecret: string;
}
