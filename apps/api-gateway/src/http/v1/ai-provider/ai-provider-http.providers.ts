import {
  AiProviderKeysClient,
  ChatSessionsClient,
  ProjectAiContextClient,
} from '@/clients/v1/ai-provider';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import {
  AiBootstrapService,
  AiProviderKeyService,
  ProjectAiContextService,
  ProjectChatSessionService,
} from '@/http/v1/shared/grpc-service-tokens';

export const AI_PROVIDER_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(AiProviderKeyService, AiProviderKeysClient, 'aiProviderKeys'),
  provideGrpcServiceProxy(ProjectAiContextService, ProjectAiContextClient, 'projectAiContext'),
  provideGrpcServiceProxy(AiBootstrapService, ProjectAiContextClient, 'projectAiContext'),
  provideGrpcServiceProxy(ProjectChatSessionService, ChatSessionsClient, 'chatSessions'),
];
