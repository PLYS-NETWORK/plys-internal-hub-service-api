import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { UserSsoProvider } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IUserSsoProviderRepository } from './interfaces';

@Injectable()
export class UserSsoProviderRepository
  extends AbstractRepository<UserSsoProvider>
  implements IUserSsoProviderRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(UserSsoProvider, manager);
  }

  public withManager(manager: EntityManager): this {
    return new UserSsoProviderRepository(manager) as this;
  }
}
