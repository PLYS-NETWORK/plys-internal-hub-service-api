import { Global, Module } from '@nestjs/common';
import { AiKeyCryptoModule } from '@plys/libraries/common-nest/crypto/ai-keys/ai-key-crypto.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { GoogleServerAiProvider } from './providers/google-server-ai.provider';
import { GroqServerAiProvider } from './providers/groq-server-ai.provider';
import { OpenAiServerAiProvider } from './providers/openai-server-ai.provider';
import { ServerAiService } from './server-ai.service';

@Global()
@Module({
  imports: [UnitOfWorkModule, AiKeyCryptoModule],
  providers: [
    ServerAiService,
    OpenAiServerAiProvider,
    GroqServerAiProvider,
    GoogleServerAiProvider,
  ],
  exports: [ServerAiService],
})
export class ServerAiModule {}
