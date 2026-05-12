import { AbstractRepository } from '@common/repositories';
import { ConsultantSkillExam } from '@database/entities';
import { SKILL_EXAM_IN_PROGRESS_STATUSES } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

import { IConsultantSkillExamRepository } from './interfaces';

@Injectable()
export class ConsultantSkillExamRepository
  extends AbstractRepository<ConsultantSkillExam>
  implements IConsultantSkillExamRepository
{
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(ConsultantSkillExam, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantSkillExamRepository(manager) as this;
  }

  public async countInProgressByConsultant(consultantId: string): Promise<number> {
    return this.repository.count({
      where: {
        consultantId,
        status: In([...SKILL_EXAM_IN_PROGRESS_STATUSES]),
      },
    });
  }

  public async findLatestByConsultantAndSkill(
    consultantId: string,
    skillId: string,
  ): Promise<ConsultantSkillExam | null> {
    return this.repository.findOne({
      where: { consultantId, skillId },
      order: { createdAt: 'DESC' },
    });
  }

  public async findByConsultant(consultantId: string): Promise<ConsultantSkillExam[]> {
    return this.repository.find({
      where: { consultantId },
      order: { createdAt: 'DESC' },
    });
  }

  public async countAttemptsByConsultantAndSkill(
    consultantId: string,
    skillId: string,
  ): Promise<number> {
    return this.repository.count({ where: { consultantId, skillId } });
  }
}
