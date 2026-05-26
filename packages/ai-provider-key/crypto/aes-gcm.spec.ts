import { describe, expect, it } from '@jest/globals';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { IAiKeysVersionedSecrets } from '@plys/libraries/common-nest/modules/environments/interfaces';
import { randomBytes } from 'crypto';

import { GcmCipher, IGcmEnvelope } from './aes-gcm';

// 32-byte base64 strings — the same shape the env validator enforces.
// Generated per test run so we don't accidentally snapshot a real value into
// a fixture.
function fakeKeyB64(): string {
  return randomBytes(32).toString('base64');
}

function makeSecrets(
  currentVersion: number,
  versions: Record<number, string>,
): IAiKeysVersionedSecrets {
  return { currentVersion, versions };
}

describe('GcmCipher', () => {
  describe('encrypt → decrypt round-trip', () => {
    it('round-trips ASCII plaintext through the current version', () => {
      // Arrange
      const v1 = fakeKeyB64();
      const secrets = makeSecrets(1, { 1: v1 });
      const plaintext = 'gsk_live_abcdef0123456789';

      // Act
      const envelope = GcmCipher.encrypt(plaintext, secrets, 'TEST');
      const decrypted = GcmCipher.decrypt(envelope, secrets, 'TEST');

      // Assert
      expect(envelope.version).toBe(1);
      expect(envelope.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(envelope.tag).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(envelope.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips Unicode plaintext (multibyte chars)', () => {
      // Arrange
      const secrets = makeSecrets(1, { 1: fakeKeyB64() });
      const plaintext = 'tøken-üç-日本語-🔑';

      // Act
      const envelope = GcmCipher.encrypt(plaintext, secrets, 'TEST');
      const decrypted = GcmCipher.decrypt(envelope, secrets, 'TEST');

      // Assert
      expect(decrypted).toBe(plaintext);
    });

    it('produces distinct ciphertexts for the same plaintext (random IV)', () => {
      // Arrange
      const secrets = makeSecrets(1, { 1: fakeKeyB64() });
      const plaintext = 'same-input';

      // Act
      const a = GcmCipher.encrypt(plaintext, secrets, 'TEST');
      const b = GcmCipher.encrypt(plaintext, secrets, 'TEST');

      // Assert
      expect(a.ciphertext).not.toEqual(b.ciphertext);
      expect(a.iv).not.toEqual(b.iv);
      expect(GcmCipher.decrypt(a, secrets, 'TEST')).toBe(plaintext);
      expect(GcmCipher.decrypt(b, secrets, 'TEST')).toBe(plaintext);
    });
  });

  describe('versioned decryption', () => {
    it('decrypts old-version ciphertext when both versions are present', () => {
      // Arrange — v1 encrypts, v2 is added later, v2 is current
      const v1 = fakeKeyB64();
      const v2 = fakeKeyB64();
      const v1OnlySecrets = makeSecrets(1, { 1: v1 });
      const dualSecrets = makeSecrets(2, { 1: v1, 2: v2 });
      const plaintext = 'rotation-survivor';
      const oldEnvelope = GcmCipher.encrypt(plaintext, v1OnlySecrets, 'TEST');

      // Act — decrypt the old envelope after a rotation deploy
      const decrypted = GcmCipher.decrypt(oldEnvelope, dualSecrets, 'TEST');
      // and re-encrypt at the current version
      const newEnvelope = GcmCipher.encrypt(plaintext, dualSecrets, 'TEST');

      // Assert
      expect(decrypted).toBe(plaintext);
      expect(oldEnvelope.version).toBe(1);
      expect(newEnvelope.version).toBe(2);
      expect(GcmCipher.decrypt(newEnvelope, dualSecrets, 'TEST')).toBe(plaintext);
    });

    it('throws when the envelope references an unknown version', () => {
      // Arrange
      const secrets = makeSecrets(1, { 1: fakeKeyB64() });
      const fakeEnvelope: IGcmEnvelope = {
        version: 99,
        iv: 'AAAAAAAAAAAAAAAA', // 12-byte base64
        tag: 'AAAAAAAAAAAAAAAAAAAAAA==', // 16-byte base64
        ciphertext: 'AAAA',
      };

      // Act + Assert
      expect(() => GcmCipher.decrypt(fakeEnvelope, secrets, 'TEST')).toThrow(TranslatableException);
    });
  });

  describe('input validation', () => {
    it('throws when currentVersion has no matching key', () => {
      // Arrange
      const secrets = makeSecrets(2, { 1: fakeKeyB64() });

      // Act + Assert
      expect(() => GcmCipher.encrypt('x', secrets, 'TEST')).toThrow(TranslatableException);
    });

    it('throws when a key is not a 32-byte base64 string', () => {
      // Arrange — too short to decode to 32 bytes
      const secrets = makeSecrets(1, { 1: 'too-short' });

      // Act + Assert
      expect(() => GcmCipher.encrypt('x', secrets, 'TEST')).toThrow(TranslatableException);
    });

    it('throws when a key contains chars outside the base64 alphabet', () => {
      // Arrange — `!` is not a valid base64 char
      const secrets = makeSecrets(1, { 1: 'C4oNA0X65aQQZ1y1n3MLugsCdCCRuFnsr1RxYhuGqE!' });

      // Act + Assert
      expect(() => GcmCipher.encrypt('x', secrets, 'TEST')).toThrow(TranslatableException);
    });

    it('accepts the documented base64 example (43 chars unpadded)', () => {
      // Arrange — exactly 32 bytes when decoded
      const secrets = makeSecrets(1, {
        1: 'C4oNA0X65aQQZ1y1n3MLugsCdCCRuFnsr1RxYhuGqEQ',
      });

      // Act — encryption succeeds, which means decodeKey accepted the value
      const envelope = GcmCipher.encrypt('x', secrets, 'TEST');

      // Assert
      expect(GcmCipher.decrypt(envelope, secrets, 'TEST')).toBe('x');
    });

    it('throws on a tampered ciphertext (auth tag fails)', () => {
      // Arrange
      const secrets = makeSecrets(1, { 1: fakeKeyB64() });
      const envelope = GcmCipher.encrypt('payload', secrets, 'TEST');
      // Flip the first byte of the ciphertext.
      const ctBuf = Buffer.from(envelope.ciphertext, 'base64');
      ctBuf[0] = ctBuf[0] ^ 0x01;
      const tampered: IGcmEnvelope = {
        ...envelope,
        ciphertext: ctBuf.toString('base64'),
      };

      // Act + Assert
      expect(() => GcmCipher.decrypt(tampered, secrets, 'TEST')).toThrow(TranslatableException);
    });
  });
});
