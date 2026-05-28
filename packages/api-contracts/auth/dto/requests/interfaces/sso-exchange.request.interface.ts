export interface ISsoExchangeRequest {
  /** Single-use code returned via the OAuth callback redirect. */
  readonly code: string;
}
