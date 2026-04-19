import { AbstractRepository } from '@common/repositories';
import { ConsultantProfile } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantProfileRepository } from './interfaces';

@Injectable()
export class ConsultantProfileRepository
  extends AbstractRepository<ConsultantProfile>
  implements IConsultantProfileRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantProfile, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantProfileRepository(manager) as this;
  }
}
