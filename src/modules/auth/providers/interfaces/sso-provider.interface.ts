import { SsoProvider } from '@database/enums/sso-provider.enum';

import { ISsoUserData } from '../../interfaces/auth-service.interface';

/**
 * Injection token for the array of registered SSO provider implementations.
 * Inject as: @Inject(SSO_PROVIDERS_TOKEN) private readonly providers: ISsoTokenProvider[]
 *
 * OCP: Adding Apple / Microsoft SSO = new file + module registration, zero
 * edits to existing services.
 */
export const SSO_PROVIDERS_TOKEN = 'SSO_PROVIDERS';

export interface ISsoTokenProvider {
  /** Discriminator used by SsoAuthService to route verifyToken calls. */
  readonly providerName: SsoProvider;

  /**
   * Verifies the provider-specific token (ID token, access token, etc.) and
   * returns a normalised ISsoUserData. Throws TranslatableException on failure.
   */
  verifyToken(idToken: string): Promise<ISsoUserData>;
}
