import { AbstractRepository } from '@common/repositories';
import { UserSsoProvider } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
