import { Module } from '@nestjs/common';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';
import { MASTER_KEY_CIPHER } from '@plys/libraries/shared-kernel';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { AiProviderKeyService } from './ai-provider-key.service';
import { BffEnvelopeCipher } from './crypto/bff-envelope.cipher';
import { MasterKeyCipher } from './crypto/master-key.cipher';

// Step C-2 wiring: BFF endpoint + admin CRUD + the two ciphers. The two
// ciphers are exported so future modules (orchestration endpoints, the chat
// session module) can resolve API keys without re-implementing the AES-GCM
// pipeline. ProjectsUnitOfWorkModule provides the AiProviderApiKey repository.
@Module({
  imports: [ProjectsUnitOfWorkModule, EnvironmentsModule],
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
