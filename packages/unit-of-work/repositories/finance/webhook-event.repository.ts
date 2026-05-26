import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { WebhookEvent } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IWebhookEventRepository } from './interfaces';

@Injectable()
export class WebhookEventRepository
  extends AbstractRepository<WebhookEvent>
  implements IWebhookEventRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(WebhookEvent, manager);
  }

  public withManager(manager: EntityManager): this {
    return new WebhookEventRepository(manager) as this;
  }
}
