import { AiProviderKeyModule } from '@modules/ai-provider-key/ai-provider-key.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Global, Module } from '@nestjs/common';

import { GoogleServerAiProvider } from './providers/google-server-ai.provider';
import { GroqServerAiProvider } from './providers/groq-server-ai.provider';
import { OpenAiServerAiProvider } from './providers/openai-server-ai.provider';
import { ServerAiService } from './server-ai.service';

@Global()
@Module({
  imports: [UnitOfWorkModule, AiProviderKeyModule],
  providers: [
    ServerAiService,
    OpenAiServerAiProvider,
    GroqServerAiProvider,
    GoogleServerAiProvider,
  ],
  exports: [ServerAiService],
})
export class ServerAiModule {}
