import { Module } from '@nestjs/common';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';
import { MASTER_KEY_CIPHER } from '@plys/libraries/shared-kernel';

import { BffEnvelopeCipher } from './bff-envelope.cipher';
import { MasterKeyCipher } from './master-key.cipher';

/** AES-GCM ciphers for AI provider API key storage and BFF wire envelopes. */
@Module({
  imports: [EnvironmentsModule],
  providers: [
    MasterKeyCipher,
    BffEnvelopeCipher,
    { provide: MASTER_KEY_CIPHER, useExisting: MasterKeyCipher },
  ],
  exports: [MasterKeyCipher, BffEnvelopeCipher, MASTER_KEY_CIPHER],
})
export class AiKeyCryptoModule {}
