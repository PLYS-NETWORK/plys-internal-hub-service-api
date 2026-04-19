import { AbstractRepository } from '@common/repositories';
import { ScreeningQuestionChoice } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IScreeningQuestionChoiceRepository } from './interfaces';

@Injectable()
export class ScreeningQuestionChoiceRepository
  extends AbstractRepository<ScreeningQuestionChoice>
  implements IScreeningQuestionChoiceRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ScreeningQuestionChoice, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ScreeningQuestionChoiceRepository(manager) as this;
  }
}
