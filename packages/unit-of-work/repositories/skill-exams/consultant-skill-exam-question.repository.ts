import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ConsultantSkillExamQuestion } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IConsultantSkillExamQuestionRepository } from './interfaces';

@Injectable()
export class ConsultantSkillExamQuestionRepository
  extends AbstractRepository<ConsultantSkillExamQuestion>
  implements IConsultantSkillExamQuestionRepository
{
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(ConsultantSkillExamQuestion, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantSkillExamQuestionRepository(manager) as this;
  }

  public async findByExamId(examId: string): Promise<ConsultantSkillExamQuestion[]> {
    return this.repository.find({
      where: { examId },
      order: { questionOrder: 'ASC' },
    });
  }
}
