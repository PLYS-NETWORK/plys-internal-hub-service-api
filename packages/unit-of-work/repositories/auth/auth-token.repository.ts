import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { AuthToken } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IAuthTokenRepository } from './interfaces';

@Injectable()
export class AuthTokenRepository
  extends AbstractRepository<AuthToken>
  implements IAuthTokenRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(AuthToken, manager);
  }

  public withManager(manager: EntityManager): this {
    return new AuthTokenRepository(manager) as this;
  }
}
