import { AbstractRepository } from '@common/repositories';
import { WebhookEvent } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IWebhookEventRepository extends AbstractRepository<WebhookEvent> {}
