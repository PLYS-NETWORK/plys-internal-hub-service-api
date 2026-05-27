import { describe, expect, it } from '@jest/globals';

import {
  decodeAes256GcmKeyBase64,
  validateAes256GcmKeyBase64,
  validateJwtHmacSecret,
} from './validators';

describe('secret validators', () => {
  const longJwtSecret = Buffer.alloc(48, 1).toString('base64');

  it('accepts the same base64-32 format for AI master and FE BFF key material', () => {
    const key = Buffer.alloc(32, 3).toString('base64');
    expect(validateAes256GcmKeyBase64(key, 'AI_KEYS_MASTER_KEY_v1')).toBeNull();
    expect(validateAes256GcmKeyBase64(key, 'FE_BFF_SECRET_v1')).toBeNull();
  });

  it('rejects JWT-length base64 (48 decoded bytes) for AES keys', () => {
    const jwtStyle = Buffer.alloc(48, 5).toString('base64');
    const issue = validateAes256GcmKeyBase64(jwtStyle, 'AI_KEYS_MASTER_KEY_v1');
    expect(issue?.message).toMatch(/expected 32/);
  });

  it('rejects AES key with wrong byte length', () => {
    expect(() => decodeAes256GcmKeyBase64(Buffer.alloc(16).toString('base64'), 'TEST_KEY')).toThrow(
      /expected 32/,
    );
  });

  it('rejects weak JWT secret in strict mode', () => {
    const { issue } = validateJwtHmacSecret('change-me', 'JWT_ACCESS_SECRET', true);
    expect(issue?.message).toMatch(/placeholder/);
  });

  it('accepts strong JWT secret in strict mode', () => {
    const { issue } = validateJwtHmacSecret(longJwtSecret, 'JWT_ACCESS_SECRET', true);
    expect(issue).toBeNull();
  });

  it('warns on weak JWT secret in local mode', () => {
    const { issue, warning } = validateJwtHmacSecret('change-me', 'JWT_ACCESS_SECRET', false);
    expect(issue).toBeNull();
    expect(warning).not.toBeNull();
  });
});
