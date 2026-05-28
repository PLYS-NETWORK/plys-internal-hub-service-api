import { Module } from '@nestjs/common';
import { AiKeyCryptoModule } from '@plys/libraries/common-nest/crypto/ai-keys/ai-key-crypto.module';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { AiProviderKeyService } from './ai-provider-key.service';

@Module({
  imports: [UnitOfWorkModule, AiKeyCryptoModule, RequestContextModule],
  controllers: [],
  providers: [AiProviderKeyService],
  exports: [AiProviderKeyService, AiKeyCryptoModule],
})
export class AiProviderKeyModule {}
