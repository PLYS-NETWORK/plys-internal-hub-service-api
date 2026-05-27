import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ProficiencyLevel } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ConsultantSkillPerformanceDto } from '../../../dto/requests/consultant-skill-performance.dto';
import { ConsultantSkillPerformanceResponseDto } from '../../../dto/responses/consultant-skill-performance-response.dto';
import { IConsultantSkillPerformanceService } from '../interfaces/consultant-skill-performance-service.interface';

const SKILL_PERFORMANCE_CACHE_TTL_SECONDS = 60;

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
    private readonly redis: RedisService,
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
    const cacheKey = `consultant:dashboard:skill_performance:${consultantId}:${dto.sort}:${dto.limit}:v1`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return plainToInstance(ConsultantSkillPerformanceResponseDto, JSON.parse(cached), {
        excludeExtraneousValues: true,
      });
    }

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
      this.uow.consultantTransactions.sumClearedEarningsByConsultantGroupedBySkill(consultantId),
    ]);

    const earningsLookup = earningsBySkill;

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

    const response = plainToInstance(
      ConsultantSkillPerformanceResponseDto,
      { skills: trimmed, generated_at: now.toISOString() },
      { excludeExtraneousValues: true },
    );
    await this.redis.set(cacheKey, JSON.stringify(response), SKILL_PERFORMANCE_CACHE_TTL_SECONDS);
    return response;
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
