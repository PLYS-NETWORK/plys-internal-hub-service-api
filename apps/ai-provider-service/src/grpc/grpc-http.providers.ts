import { AiBootstrapController } from '@modules/ai-bootstrap/ai-bootstrap.controller';
import { AiProviderKeyAdminController, AiProviderKeyBffController } from '@modules/ai-provider-key';
import { ProjectAiContextController } from '@modules/project-ai-context/project-ai-context.controller';
import { ChatSessionsController } from '@modules/project-chat-session/controllers/chat-sessions.controller';
import { ProjectSessionsController } from '@modules/project-chat-session/controllers/project-sessions.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(AiProviderKeyAdminController),
  controllerProvider(AiProviderKeyBffController),
  controllerProvider(ProjectAiContextController),
  controllerProvider(AiBootstrapController),
  controllerProvider(ProjectSessionsController),
  controllerProvider(ChatSessionsController),
];
