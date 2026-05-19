import { AbstractRepository } from '@common/repositories';
import { ConsultantSkillExam } from '@database/entities';
import { SKILL_EXAM_IN_PROGRESS_STATUSES, SkillExamStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In, LessThan } from 'typeorm';

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

  public async findCurrentByConsultant(consultantId: string): Promise<ConsultantSkillExam | null> {
    return this.repository.findOne({
      where: {
        consultantId,
        status: In([...SKILL_EXAM_IN_PROGRESS_STATUSES]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  public async findExpiredInProgress(limit: number): Promise<ConsultantSkillExam[]> {
    return this.repository.find({
      where: {
        status: SkillExamStatus.IN_PROGRESS,
        expiresAt: LessThan(new Date()),
      },
      order: { expiresAt: 'ASC' },
      take: limit,
    });
  }

  /** @inheritdoc */
  public async countAwaitingReview(): Promise<number> {
    return this.repository.count({
      where: {
        status: In([SkillExamStatus.SUBMITTED, SkillExamStatus.COPYLEAKS_FAILED]),
      },
    });
  }

  /** @inheritdoc */
  public async findActiveByConsultantIdWithSkill(
    consultantId: string,
  ): Promise<ConsultantSkillExam | null> {
    return this.repository.findOne({
      where: {
        consultantId,
        status: In([...SKILL_EXAM_IN_PROGRESS_STATUSES]),
      },
      relations: ['skill'],
      order: { createdAt: 'DESC' },
    });
  }

  /** @inheritdoc */
  public async countPassedByConsultantId(consultantId: string): Promise<number> {
    return this.repository.count({
      where: { consultantId, status: SkillExamStatus.PASSED },
    });
  }

  /** @inheritdoc */
  public async countPassedByConsultantGroupedBySkill(
    consultantId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.createQueryBuilder('exam')
      .select('exam.skill_id', 'skill_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('exam.consultant_id = :consultantId', { consultantId })
      .andWhere('exam.status = :status', { status: SkillExamStatus.PASSED })
      .groupBy('exam.skill_id')
      .getRawMany<{ skill_id: string; count: number }>();
    const out = new Map<string, number>();
    for (const row of rows) out.set(row.skill_id, Number(row.count));
    return out;
  }
}
