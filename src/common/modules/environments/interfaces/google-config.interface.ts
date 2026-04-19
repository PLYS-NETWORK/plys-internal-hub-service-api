export interface IGoogleConfig {
  readonly googleClientId: string | undefined;
  readonly googleClientSecret: string | undefined;
  readonly googleCallbackUrl: string | undefined;
  readonly isGoogleOAuthConfigured: boolean;
  readonly ployosUrl: string;
  readonly lonaUrl: string;
}
