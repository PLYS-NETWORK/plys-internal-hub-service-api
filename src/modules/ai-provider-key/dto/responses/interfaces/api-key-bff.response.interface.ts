import { AiProvider } from '@database/enums';

// Wire format from GET /ai-provider-keys/active. The FE BFF decrypts
// `key_envelope` with FE_BFF_SECRET_v<version> to recover the plaintext API
// key, then drives model traffic on the user's behalf.
export interface IApiKeyEnvelope {
  /** FE_BFF_SECRET version that wraps `ciphertext`. */
  version: number;
  /** Initialisation vector, 12 bytes, base64. */
  iv: string;
  /** AES-GCM authentication tag, 16 bytes, base64. */
  tag: string;
  /** Ciphertext of the plaintext API key, base64. */
  ciphertext: string;
}

export interface IApiKeyBffResponse {
  provider: AiProvider;
  model: string;
  key_envelope: IApiKeyEnvelope;
  key_last4: string;
  expires_at: string;
}
