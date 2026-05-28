import { PlatformHealthClient, SkillsClient } from '@/clients/v1/platform';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import { HealthService, SkillsService } from '@/http/v1/shared/grpc-service-tokens';

export const PLATFORM_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(SkillsService, SkillsClient, 'skills'),
  provideGrpcServiceProxy(HealthService, PlatformHealthClient, 'health'),
];
