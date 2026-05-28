import { describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { IAiKeysVersionedSecrets } from '@plys/libraries/common-nest/modules/environments/interfaces';
import { randomBytes } from 'crypto';

import { BffEnvelopeCipher } from './bff-envelope.cipher';

function fakeKeyB64(): string {
  return randomBytes(32).toString('base64');
}

function makeEnv(secrets: IAiKeysVersionedSecrets): Partial<EnvironmentsService> {
  return { aiKeysBff: secrets } as Partial<EnvironmentsService>;
}

async function buildCipher(secrets: IAiKeysVersionedSecrets): Promise<BffEnvelopeCipher> {
  const moduleRef = await Test.createTestingModule({
    providers: [BffEnvelopeCipher, { provide: EnvironmentsService, useValue: makeEnv(secrets) }],
  }).compile();
  return moduleRef.get(BffEnvelopeCipher);
}

describe('BffEnvelopeCipher', () => {
  it('encrypts to a JSON envelope shape that round-trips back to plaintext', async () => {
    // Arrange
    const secrets: IAiKeysVersionedSecrets = {
      currentVersion: 1,
      versions: { 1: fakeKeyB64() },
    };
    const cipher = await buildCipher(secrets);
    const plaintext = 'gsk_live_abcdef0123456789';

    // Act — encrypt on this side, then decrypt as the FE BFF would
    const envelope = cipher.encrypt(plaintext);
    const decrypted = cipher.decrypt(envelope);

    // Assert
    expect(envelope).toEqual(
      expect.objectContaining({
        version: 1,
        iv: expect.stringMatching(/^[A-Za-z0-9+/=]+$/),
        tag: expect.stringMatching(/^[A-Za-z0-9+/=]+$/),
        ciphertext: expect.stringMatching(/^[A-Za-z0-9+/=]+$/),
      }),
    );
    expect(decrypted).toBe(plaintext);
  });

  it('survives a BFF secret rotation (FE BFF re-fetches before v1 retires)', async () => {
    // Arrange — gateway and FE BFF both run v1
    const v1 = fakeKeyB64();
    const v1Cipher = await buildCipher({ currentVersion: 1, versions: { 1: v1 } });
    const v1Envelope = v1Cipher.encrypt('payload');

    // BFF cache hits before rotation
    expect(v1Cipher.decrypt(v1Envelope)).toBe('payload');

    // Rotation: gateway adds v2 and cuts current to v2; FE BFF still has v1 + v2
    const v2 = fakeKeyB64();
    const dualCipher = await buildCipher({
      currentVersion: 2,
      versions: { 1: v1, 2: v2 },
    });

    // Act
    const newEnvelope = dualCipher.encrypt('payload');

    // Assert — FE BFF can still decrypt the in-flight v1 envelope (cache drain
    // window) and any new v2 envelope going forward
    expect(dualCipher.decrypt(v1Envelope)).toBe('payload');
    expect(dualCipher.decrypt(newEnvelope)).toBe('payload');
    expect(newEnvelope.version).toBe(2);
  });
});
