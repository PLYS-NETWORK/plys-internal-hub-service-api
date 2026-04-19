import { AbstractRepository } from '@common/repositories';
import { Notification } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { INotificationRepository } from './interfaces';

@Injectable()
export class NotificationRepository
  extends AbstractRepository<Notification>
  implements INotificationRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Notification, manager);
  }

  public withManager(manager: EntityManager): this {
    return new NotificationRepository(manager) as this;
  }
}
