import { AbstractRepository } from '@common/repositories';
import { ApplicationAnswer } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IApplicationAnswerRepository } from './interfaces';

@Injectable()
export class ApplicationAnswerRepository
  extends AbstractRepository<ApplicationAnswer>
  implements IApplicationAnswerRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ApplicationAnswer, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ApplicationAnswerRepository(manager) as this;
  }
}
