import { NotificationsClient } from '@/clients/v1/notifications';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import { NotificationsService } from '@/http/v1/shared/grpc-service-tokens';

export const NOTIFICATIONS_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(NotificationsService, NotificationsClient, 'notifications'),
];
