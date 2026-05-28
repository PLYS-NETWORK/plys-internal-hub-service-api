import { Injectable } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { GcmCipher, IGcmEnvelope } from './aes-gcm';

// Wraps the GET /ai-provider-keys/active response payload before it leaves the
// gateway. The FE BFF (Next.js server) holds a matching FE_BFF_SECRET_v<N>
// in its env and calls `decrypt` to recover the plaintext API key, then
// proxies model traffic on the user's behalf. Browsers never see the key.
//
// The envelope is the JSON shape from `IGcmEnvelope` plus a `version` field;
// the FE BFF picks the right decryption key from its own env using that
// version. Defends against passive logging or misconfigured proxies on the
// hop between BE and BFF — HTTPS already protects in transit, this is a
// belt-and-braces secondary layer.

const LABEL = 'FE_BFF_SECRET';

export interface IBffEnvelopeCipher {
  /** Encrypts plaintext under the current BFF version. */
  encrypt(plaintext: string): IGcmEnvelope;
  /** Convenience for tests / re-validation: round-trips an envelope back to plaintext. */
  decrypt(envelope: IGcmEnvelope): string;
}

@Injectable()
export class BffEnvelopeCipher implements IBffEnvelopeCipher {
  constructor(private readonly env: EnvironmentsService) {}

  /** @inheritdoc */
  public encrypt(plaintext: string): IGcmEnvelope {
    return GcmCipher.encrypt(plaintext, this.env.aiKeysBff, LABEL);
  }

  /** @inheritdoc */
  public decrypt(envelope: IGcmEnvelope): string {
    return GcmCipher.decrypt(envelope, this.env.aiKeysBff, LABEL);
  }
}
