/**
 * NestJS injection token for the IEmailProvider strategy.
 * Bind a concrete provider to this token in EmailModule.
 * To swap providers, change only the binding — no consumers are affected.
 */
export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER_TOKEN';
