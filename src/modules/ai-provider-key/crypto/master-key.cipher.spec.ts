import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { IAiKeysVersionedSecrets } from '@common/modules/environments/interfaces';
import { describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'crypto';

import { MasterKeyCipher } from './master-key.cipher';

function fakeKeyHex(): string {
  return randomBytes(32).toString('hex');
}

function makeEnv(secrets: IAiKeysVersionedSecrets): Partial<EnvironmentsService> {
  return { aiKeysMaster: secrets } as Partial<EnvironmentsService>;
}

async function buildCipher(secrets: IAiKeysVersionedSecrets): Promise<MasterKeyCipher> {
  const moduleRef = await Test.createTestingModule({
    providers: [MasterKeyCipher, { provide: EnvironmentsService, useValue: makeEnv(secrets) }],
  }).compile();
  return moduleRef.get(MasterKeyCipher);
}

describe('MasterKeyCipher', () => {
  describe('encrypt → decrypt round-trip', () => {
    it('serialises with a v<N>: prefix and round-trips', async () => {
      // Arrange
      const cipher = await buildCipher({ currentVersion: 1, versions: { 1: fakeKeyHex() } });
      const plaintext = 'gsk_live_abcdef0123456789';

      // Act
      const { ciphertext, version } = cipher.encrypt(plaintext);
      const decrypted = cipher.decrypt(ciphertext);

      // Assert
      expect(version).toBe(1);
      expect(ciphertext.startsWith('v1:')).toBe(true);
      expect(ciphertext.split(':')).toHaveLength(4);
      expect(decrypted).toBe(plaintext);
    });

    it('survives a master key rotation (decrypt v1 after v2 is current)', async () => {
      // Arrange — encrypt under v1
      const v1 = fakeKeyHex();
      const v2 = fakeKeyHex();
      const v1Cipher = await buildCipher({ currentVersion: 1, versions: { 1: v1 } });
      const stored = v1Cipher.encrypt('payload').ciphertext;

      // Switch to v2 (both versions still in env)
      const dualCipher = await buildCipher({
        currentVersion: 2,
        versions: { 1: v1, 2: v2 },
      });

      // Act
      const decryptedAfterRotation = dualCipher.decrypt(stored);
      const newCiphertext = dualCipher.encrypt('payload').ciphertext;

      // Assert
      expect(decryptedAfterRotation).toBe('payload');
      expect(newCiphertext.startsWith('v2:')).toBe(true);
    });
  });

  describe('failure modes', () => {
    it('rejects malformed serialised ciphertext (wrong segment count)', async () => {
      // Arrange
      const cipher = await buildCipher({ currentVersion: 1, versions: { 1: fakeKeyHex() } });

      // Act + Assert
      expect(() => cipher.decrypt('v1:only-two-parts')).toThrow(TranslatableException);
    });

    it('rejects ciphertext with an unknown version prefix', async () => {
      // Arrange
      const cipher = await buildCipher({ currentVersion: 1, versions: { 1: fakeKeyHex() } });
      const valid = cipher.encrypt('x').ciphertext;
      // Replace `v1` with `v9` — version not configured
      const tampered = valid.replace(/^v1:/, 'v9:');

      // Act + Assert
      expect(() => cipher.decrypt(tampered)).toThrow(TranslatableException);
    });

    it('reports the current version via getCurrentVersion()', async () => {
      // Arrange
      const cipher = await buildCipher({
        currentVersion: 7,
        versions: { 1: fakeKeyHex(), 7: fakeKeyHex() },
      });

      // Act + Assert
      expect(cipher.getCurrentVersion()).toBe(7);
    });
  });
});
