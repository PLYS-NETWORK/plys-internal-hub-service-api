import { AbstractRepository } from '@common/repositories';
import { BusinessMember } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IBusinessMemberRepository } from './interfaces';

@Injectable()
export class BusinessMemberRepository
  extends AbstractRepository<BusinessMember>
  implements IBusinessMemberRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(BusinessMember, manager);
  }

  public withManager(manager: EntityManager): this {
    return new BusinessMemberRepository(manager) as this;
  }
}
