import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { WebhookEvent } from '@plys/libraries/database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IWebhookEventRepository extends AbstractRepository<WebhookEvent> {}
