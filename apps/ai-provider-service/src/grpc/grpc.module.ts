import { AiBootstrapModule } from '@modules/ai-bootstrap/ai-bootstrap.module';
import { AiProviderKeyModule } from '@modules/ai-provider-key/ai-provider-key.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { ProjectChatSessionModule } from '@modules/project-chat-session/project-chat-session.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [
    AiProviderKeyModule,
    ProjectAiContextModule,
    ProjectChatSessionModule,
    AiBootstrapModule,
  ],
})
export class GrpcModule {}
