import { Module } from '@nestjs/common';

import { AiProviderClientsModule } from '@/clients/v1/ai-provider';

import { gatewayBffGuardProviders } from '../shared/gateway-http-auth.providers';
import { AI_PROVIDER_HTTP_PROVIDERS } from './ai-provider-http.providers';
import { AiBootstrapController } from './controllers/ai-bootstrap.controller';
import { AiProviderKeyAdminController } from './controllers/ai-provider-key-admin.controller';
import { AiProviderKeyBffController } from './controllers/ai-provider-key-bff.controller';
import { ChatSessionsController } from './controllers/chat-sessions.controller';
import { ProjectAiContextController } from './controllers/project-ai-context.controller';
import { ProjectSessionsController } from './controllers/project-sessions.controller';

@Module({
  imports: [AiProviderClientsModule],
  controllers: [
    AiProviderKeyAdminController,
    AiProviderKeyBffController,
    ProjectAiContextController,
    AiBootstrapController,
    ProjectSessionsController,
    ChatSessionsController,
  ],
  providers: [...AI_PROVIDER_HTTP_PROVIDERS, ...gatewayBffGuardProviders],
})
export class AiProviderHttpModule {}
