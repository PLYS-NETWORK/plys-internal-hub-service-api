import { AbstractRepository } from '@common/repositories';
import { Notification } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface INotificationRepository extends AbstractRepository<Notification> {}
