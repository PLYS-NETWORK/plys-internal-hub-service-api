import { EnvironmentsModule } from '@common/modules/environments';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { AiProviderKeyService } from './ai-provider-key.service';
import { AiProviderKeyAdminController } from './ai-provider-key-admin.controller';
import { AiProviderKeyBffController } from './ai-provider-key-bff.controller';
import { BffEnvelopeCipher } from './crypto/bff-envelope.cipher';
import { MasterKeyCipher } from './crypto/master-key.cipher';

// Step C-2 wiring: BFF endpoint + admin CRUD + the two ciphers. The two
// ciphers are exported so future modules (orchestration endpoints, the chat
// session module) can resolve API keys without re-implementing the AES-GCM
// pipeline. UnitOfWorkModule provides the AiProviderApiKey repository.
@Module({
  imports: [UnitOfWorkModule, EnvironmentsModule],
  controllers: [AiProviderKeyBffController, AiProviderKeyAdminController],
  providers: [AiProviderKeyService, MasterKeyCipher, BffEnvelopeCipher],
  exports: [AiProviderKeyService, MasterKeyCipher, BffEnvelopeCipher],
})
export class AiProviderKeyModule {}
