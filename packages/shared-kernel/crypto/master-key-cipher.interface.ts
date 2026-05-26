/** Port for decrypting AI provider API keys stored in the database. */
export interface IMasterKeyCipher {
  encrypt(plaintext: string): { ciphertext: string; version: number };
  decrypt(ciphertext: string): string;
  getCurrentVersion(): number;
}

export const MASTER_KEY_CIPHER = Symbol('MASTER_KEY_CIPHER');
