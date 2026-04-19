import { AbstractRepository } from '@common/repositories';
import { WebhookEvent } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
