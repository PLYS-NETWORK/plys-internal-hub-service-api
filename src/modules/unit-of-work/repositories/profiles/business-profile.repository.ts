import { AbstractRepository } from '@common/repositories';
import { BusinessProfile } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IBusinessProfileRepository } from './interfaces';

@Injectable()
export class BusinessProfileRepository
  extends AbstractRepository<BusinessProfile>
  implements IBusinessProfileRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(BusinessProfile, manager);
  }

  public withManager(manager: EntityManager): this {
    return new BusinessProfileRepository(manager) as this;
  }
}
