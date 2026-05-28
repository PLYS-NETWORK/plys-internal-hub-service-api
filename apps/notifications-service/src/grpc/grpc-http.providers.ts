import { NotificationInternalController } from '@modules/notifications/controllers/notification-internal.controller';
import { NotificationsController } from '@modules/notifications/notifications.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(NotificationsController),
  controllerProvider(NotificationInternalController),
];
