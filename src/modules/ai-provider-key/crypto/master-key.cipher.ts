import { EnvironmentsService } from '@common/modules/environments';
import { Injectable } from '@nestjs/common';

import { failCipher, GcmCipher, IGcmEnvelope } from './aes-gcm';

// Encrypts model API keys for storage in `ai_provider_api_key.key_ciphertext`.
// At-rest envelope is serialised compactly so the column type can stay TEXT
// without a JSON column on every row.
//
// Wire format on disk (single string):
//   "v<N>:<iv_b64>:<tag_b64>:<ciphertext_b64>"
//
// The version prefix is duplicated in the row's `master_key_version` column
// for cheap querying ("which rows still need re-encryption?") without a
// per-row decode pass.

const SEPARATOR = ':';
const LABEL = 'AI_KEYS_MASTER_KEY';

export interface IMasterKeyCipher {
  /** Encrypts plaintext under the current master version. */
  encrypt(plaintext: string): { ciphertext: string; version: number };
  /** Decrypts a previously-stored ciphertext. */
  decrypt(ciphertext: string): string;
  /** Exposes the version used for new encryptions — for write-time bookkeeping. */
  getCurrentVersion(): number;
}

@Injectable()
export class MasterKeyCipher implements IMasterKeyCipher {
  constructor(private readonly env: EnvironmentsService) {}

  /** @inheritdoc */
  public encrypt(plaintext: string): { ciphertext: string; version: number } {
    const envelope = GcmCipher.encrypt(plaintext, this.env.aiKeysMaster, LABEL);
    return {
      ciphertext: this.serialise(envelope),
      version: envelope.version,
    };
  }

  /** @inheritdoc */
  public decrypt(ciphertext: string): string {
    return GcmCipher.decrypt(this.parse(ciphertext), this.env.aiKeysMaster, LABEL);
  }

  /** @inheritdoc */
  public getCurrentVersion(): number {
    return this.env.aiKeysMaster.currentVersion;
  }

  private serialise(envelope: IGcmEnvelope): string {
    return `v${envelope.version}${SEPARATOR}${envelope.iv}${SEPARATOR}${envelope.tag}${SEPARATOR}${envelope.ciphertext}`;
  }

  private parse(serialised: string): IGcmEnvelope {
    const parts = serialised.split(SEPARATOR);
    if (parts.length !== 4) {
      failCipher(`${LABEL}: malformed envelope (expected 4 segments)`);
    }
    const [versionToken, iv, tag, ciphertext] = parts;
    if (!versionToken.startsWith('v')) {
      failCipher(`${LABEL}: malformed envelope (missing version prefix)`);
    }
    const version = parseInt(versionToken.slice(1), 10);
    if (!Number.isInteger(version) || version <= 0) {
      failCipher(`${LABEL}: malformed envelope (invalid version)`);
    }
    return { version, iv, tag, ciphertext };
  }
}
