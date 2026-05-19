import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProficiencyLevel } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ConsultantSkillPerformanceDto } from '../../../dto/requests/consultant-skill-performance.dto';
import { ConsultantSkillPerformanceResponseDto } from '../../../dto/responses/consultant-skill-performance-response.dto';
import { IConsultantSkillPerformanceService } from '../interfaces/consultant-skill-performance-service.interface';

interface ISkillItem {
  skill_id: string;
  skill_name: string;
  proficiency_level: ProficiencyLevel | null;
  exam_score: string | null;
  last_certified_at: string | null;
  total_passed_exams: number;
  active_projects_count: number;
  tasks_completed_lifetime: number;
  earnings_from_skill: string;
}

@Injectable()
export class ConsultantSkillPerformanceService implements IConsultantSkillPerformanceService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantSkillPerformanceService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(
    dto: ConsultantSkillPerformanceDto,
  ): Promise<ConsultantSkillPerformanceResponseDto> {
    const userId = this.requestContext.userId!;
    const consultantProfile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!consultantProfile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const consultantId = consultantProfile.id;
    const now = new Date();

    this.logger.log(
      `get — start | consultantId: ${consultantId}, sort: ${dto.sort}, limit: ${dto.limit}`,
    );

    const skillRows = await this.uow.consultantSkills.findByConsultantIdWithSkill(consultantId);
    if (skillRows.length === 0) {
      this.logger.log(`get — complete | consultantId: ${consultantId}, skills: 0`);
      return plainToInstance(
        ConsultantSkillPerformanceResponseDto,
        { skills: [], generated_at: now.toISOString() },
        { excludeExtraneousValues: true },
      );
    }

    const skillIds = skillRows.map((r) => r.skillId);

    const [
      passedCountsBySkill,
      lastCertifiedBySkill,
      activeProjectsBySkill,
      completedTasksBySkill,
      earningsBySkill,
    ] = await Promise.all([
      this.uow.consultantSkillExams.countPassedByConsultantGroupedBySkill(consultantId),
      this.uow.consultantSkillScores.findLatestPassedByConsultantGroupedBySkill(consultantId),
      this.uow.projectRequiredSkills.countActiveProjectsByConsultantGroupedBySkill(
        consultantId,
        skillIds,
      ),
      this.uow.tasks.countDoneByAssigneeGroupedBySkill(consultantId, skillIds),
      // Earnings need per-skill summation; fan out one query per skill. Cap
      // the parallelism implicitly via the limit-bounded skill list.
      Promise.all(
        skillIds.map(async (skillId) => ({
          skillId,
          amount: await this.uow.consultantTransactions.sumClearedEarningsByConsultantAndSkillId(
            consultantId,
            skillId,
          ),
        })),
      ),
    ]);

    const earningsLookup = new Map<string, string>();
    for (const row of earningsBySkill) earningsLookup.set(row.skillId, row.amount);

    const items: ISkillItem[] = skillRows.map((row) => {
      const lastCertified = lastCertifiedBySkill.get(row.skillId) ?? null;
      return {
        skill_id: row.skillId,
        skill_name: row.skill.name,
        proficiency_level: row.proficiencyLevel,
        exam_score: row.rating,
        last_certified_at: lastCertified ? lastCertified.toISOString() : null,
        total_passed_exams: passedCountsBySkill.get(row.skillId) ?? 0,
        active_projects_count: activeProjectsBySkill.get(row.skillId) ?? 0,
        tasks_completed_lifetime: completedTasksBySkill.get(row.skillId) ?? 0,
        earnings_from_skill: earningsLookup.get(row.skillId) ?? '0.00',
      };
    });

    items.sort((a, b) => this.compare(a, b, dto.sort));

    const trimmed = items.slice(0, dto.limit);
    this.logger.log(`get — complete | consultantId: ${consultantId}, skills: ${trimmed.length}`);

    return plainToInstance(
      ConsultantSkillPerformanceResponseDto,
      { skills: trimmed, generated_at: now.toISOString() },
      { excludeExtraneousValues: true },
    );
  }

  // null-aware comparators: rows with `null` metric land last regardless of
  // sort direction so they don't crowd the top of the list with "0".
  private compare(
    a: ISkillItem,
    b: ISkillItem,
    sort: ConsultantSkillPerformanceDto['sort'],
  ): number {
    switch (sort) {
      case 'earnings_desc': {
        return Number(b.earnings_from_skill) - Number(a.earnings_from_skill);
      }
      case 'rating_desc': {
        const av = a.exam_score !== null ? Number(a.exam_score) : -1;
        const bv = b.exam_score !== null ? Number(b.exam_score) : -1;
        return bv - av;
      }
      case 'completed_tasks_desc':
      default:
        return b.tasks_completed_lifetime - a.tasks_completed_lifetime;
    }
  }
}
