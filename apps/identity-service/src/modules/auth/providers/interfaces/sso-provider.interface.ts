import { SsoProvider } from '@plys/libraries/database/enums';

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
   * returns a normalised `ISsoUserData`.
   *
   * Implementations must validate the token's signature, expiry, and audience
   * against the configured client ID before extracting user data.
   *
   * @param idToken - The raw ID token (or access token) issued by the provider.
   * @returns Normalised `ISsoUserData` containing the provider user ID, email,
   *          display name, and raw access/refresh tokens.
   * @throws TranslatableException (401) — token is invalid, expired, or the
   *         payload could not be extracted.
   */
  verifyToken(idToken: string): Promise<ISsoUserData>;
}
