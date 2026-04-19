import { AbstractRepository } from '@common/repositories';
import { ScreeningQuestion } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IScreeningQuestionRepository } from './interfaces';

@Injectable()
export class ScreeningQuestionRepository
  extends AbstractRepository<ScreeningQuestion>
  implements IScreeningQuestionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ScreeningQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ScreeningQuestionRepository(manager) as this;
  }
}
