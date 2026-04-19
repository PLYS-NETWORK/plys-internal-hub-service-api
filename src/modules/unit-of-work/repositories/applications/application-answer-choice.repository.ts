import { AbstractRepository } from '@common/repositories';
import { ApplicationAnswerChoice } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IApplicationAnswerChoiceRepository } from './interfaces';

@Injectable()
export class ApplicationAnswerChoiceRepository
  extends AbstractRepository<ApplicationAnswerChoice>
  implements IApplicationAnswerChoiceRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ApplicationAnswerChoice, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ApplicationAnswerChoiceRepository(manager) as this;
  }
}
