export interface IGoogleConfig {
  /** Google OAuth 2.0 client ID. `undefined` disables the Google SSO flow. */
  readonly googleClientId: string | undefined;

  /** Google OAuth 2.0 client secret. `undefined` disables the Google SSO flow. */
  readonly googleClientSecret: string | undefined;

  /** Absolute URL Google redirects to after user consent. Must match the OAuth app's authorised redirect URIs. */
  readonly googleCallbackUrl: string | undefined;

  /** `true` only when all three Google OAuth fields (`clientId`, `clientSecret`, `callbackUrl`) are set. */
  readonly isGoogleOAuthConfigured: boolean;

  /** Base URL for the Business platform frontend (Ployos). Used to build post-auth redirect URLs. */
  readonly ployosUrl: string;

  /** Base URL for the Consultant platform frontend (Lona). Used to build post-auth redirect URLs. */
  readonly lonaUrl: string;
}
