import { AbstractRepository } from '@common/repositories';
import { UserSession } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IUserSessionRepository } from './interfaces';

@Injectable()
export class UserSessionRepository
  extends AbstractRepository<UserSession>
  implements IUserSessionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(UserSession, manager);
  }

  public withManager(manager: EntityManager): this {
    return new UserSessionRepository(manager) as this;
  }
}
