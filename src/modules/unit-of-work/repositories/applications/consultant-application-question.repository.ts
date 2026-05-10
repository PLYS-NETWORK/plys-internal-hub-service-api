import { AbstractRepository } from '@common/repositories';
import { ConsultantApplicationQuestion } from '@database/entities';
import { QuestionType } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantApplicationQuestionRepository } from './interfaces';

@Injectable()
export class ConsultantApplicationQuestionRepository
  extends AbstractRepository<ConsultantApplicationQuestion>
  implements IConsultantApplicationQuestionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantApplicationQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantApplicationQuestionRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findByApplicationId(
    applicationId: string,
  ): Promise<ConsultantApplicationQuestion[]> {
    return this.find({
      where: { applicationId },
      order: { questionOrder: 'ASC' },
    });
  }

  /** @inheritdoc */
  public async findByApplicationIdAndType(
    applicationId: string,
    type: QuestionType,
  ): Promise<ConsultantApplicationQuestion[]> {
    return this.find({
      where: { applicationId, type },
      order: { questionOrder: 'ASC' },
    });
  }
}
