import { Module } from '@nestjs/common';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import { MASTER_KEY_CIPHER } from '@plys/libraries/shared-kernel';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { AiProviderKeyService } from './ai-provider-key.service';
import { BffEnvelopeCipher } from './crypto/bff-envelope.cipher';
import { MasterKeyCipher } from './crypto/master-key.cipher';

// Step C-2 wiring: BFF endpoint + admin CRUD + the two ciphers. The two
// ciphers are exported so future modules (orchestration endpoints, the chat
// session module) can resolve API keys without re-implementing the AES-GCM
// pipeline. UnitOfWorkModule provides the AiProviderApiKey repository alias.
@Module({
  imports: [UnitOfWorkModule, EnvironmentsModule, RequestContextModule],
  controllers: [],
  providers: [
    AiProviderKeyService,
    MasterKeyCipher,
    BffEnvelopeCipher,
    { provide: MASTER_KEY_CIPHER, useExisting: MasterKeyCipher },
  ],
  exports: [AiProviderKeyService, MasterKeyCipher, BffEnvelopeCipher, MASTER_KEY_CIPHER],
})
export class AiProviderKeyModule {}
