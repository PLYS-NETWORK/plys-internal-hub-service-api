import { AbstractRepository } from '@common/repositories';
import { InterviewQuestion } from '@database/entities';
import { QuestionType } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IInterviewQuestionRepository } from './interfaces';

@Injectable()
export class InterviewQuestionRepository
  extends AbstractRepository<InterviewQuestion>
  implements IInterviewQuestionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(InterviewQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new InterviewQuestionRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findActiveByType(type: QuestionType): Promise<InterviewQuestion[]> {
    return this.find({
      where: { type, isActive: true },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }
}
