import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ConsultantSkillExamAnswer } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IConsultantSkillExamAnswerRepository } from './interfaces';

@Injectable()
export class ConsultantSkillExamAnswerRepository
  extends AbstractRepository<ConsultantSkillExamAnswer>
  implements IConsultantSkillExamAnswerRepository
{
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(ConsultantSkillExamAnswer, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantSkillExamAnswerRepository(manager) as this;
  }

  public async findByExamId(examId: string): Promise<ConsultantSkillExamAnswer[]> {
    return this.repository
      .createQueryBuilder('a')
      .innerJoin('a.examQuestion', 'q')
      .where('q.examId = :examId', { examId })
      .getMany();
  }
}
