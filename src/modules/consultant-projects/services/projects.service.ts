import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Project } from '@database/entities';
import { ProjectMemberStatus, ProjectPaymentType, ProjectStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';

import {
  ConsultantProjectDetailResponseDto,
  ConsultantProjectListItemResponseDto,
} from '../dto/responses';
import { IConsultantProjectsService } from '../interfaces/consultant-projects.service.interface';
import { ACCESSIBLE_PROJECT_STATUSES, ConsultantAccessService } from './consultant-access.service';

// Provisional cap for `is_available_to_apply` until the consultant_profiles
// table gains an explicit column / DB trigger. Documented in the plan §10.1.
const MAX_CONCURRENT_PROJECTS = 5;

/**
 * Consultant-side discovery + detail. Mirrors `BusinessProjectsService` in
 * `business-projects/services/projects/projects.service.ts`. Read-only;
 * mutating flows (apply, withdraw) live in `applications` module.
 */
@Injectable()
export class ConsultantProjectsService implements IConsultantProjectsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: ConsultantAccessService,
  ) {
    this.logger = new AppLogger(ConsultantProjectsService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ConsultantProjectListItemResponseDto>> {
    const consultantProfile = await this.access.resolveConsultantProfile();
    const consultantId = consultantProfile.id;
    this.logger.log(
      `list — start | consultantId: ${consultantId}, page: ${pageOptions.page}, limit: ${pageOptions.limit}`,
    );

    const consultantSkills = await this.uow.consultantSkills.findByConsultantId(consultantId);
    const skillIds = consultantSkills.map((cs) => cs.skillId);

    if (skillIds.length === 0) {
      this.logger.warn(`list — consultant has no skills | consultantId: ${consultantId}`);
      return new PageDto([], new PageMetaDto({ pageOptionsDto: pageOptions, itemCount: 0 }));
    }

    const [projects, itemCount] = await this.uow.projects.findAccessibleMatchingSkills(
      skillIds,
      [...ACCESSIBLE_PROJECT_STATUSES],
      pageOptions.skip,
      pageOptions.limit,
    );
    if (projects.length === 0) {
      return new PageDto([], new PageMetaDto({ pageOptionsDto: pageOptions, itemCount }));
    }

    const projectIds = projects.map((p) => p.id);
    const businessIds = Array.from(new Set(projects.map((p) => p.businessId)));

    // Run cross-cutting aggregations in parallel — all keyed by projectId so
    // building the response is a constant-cost lookup.
    const [
      businessProfiles,
      requiredCounts,
      matchedCounts,
      avgPriceMap,
      memberCounts,
      appliedSet,
      activeMembershipCount,
    ] = await Promise.all([
      this.loadBusinessProfilesById(businessIds),
      this.countRequiredSkillsByProject(projectIds),
      this.countMatchedSkillsByProject(projectIds, consultantId),
      this.uow.tasks.avgPriceByProjectIds(projectIds),
      this.uow.projectMembers.countActiveByProjectIds(projectIds),
      this.uow.projectApplications.findActiveProjectIdsByConsultantAndProjects(
        consultantId,
        projectIds,
      ),
      this.countActiveMemberships(consultantId),
    ]);

    const data = projects.map((project) =>
      this.toListItem(
        project,
        businessProfiles.get(project.businessId),
        requiredCounts.get(project.id) ?? 0,
        matchedCounts.get(project.id) ?? 0,
        avgPriceMap.get(project.id) ?? null,
        memberCounts.get(project.id) ?? 0,
        appliedSet.has(project.id),
        activeMembershipCount,
      ),
    );

    this.logger.log(
      `list — complete | consultantId: ${consultantId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, new PageMetaDto({ pageOptionsDto: pageOptions, itemCount }));
  }

  /** @inheritdoc */
  public async getDetail(projectId: string): Promise<ConsultantProjectDetailResponseDto> {
    const { project, consultantProfile } = await this.access.resolveAccessibleProject(projectId);
    const consultantId = consultantProfile.id;
    this.logger.log(`getDetail — start | projectId: ${projectId}, consultantId: ${consultantId}`);

    const [
      businessProfile,
      requiredCount,
      matchedCount,
      memberCount,
      isApplied,
      hasInterview,
      activeMembershipCount,
    ] = await Promise.all([
      this.uow.businessProfiles.findOne({ where: { id: project.businessId } }),
      this.uow.projectRequiredSkills.count({ where: { projectId } }),
      this.uow.consultantSkills
        .createQueryBuilder('cs')
        .select('COUNT(*)::int', 'count')
        .where('cs.consultant_id = :consultantId', { consultantId })
        .andWhere(
          'cs.skill_id IN (SELECT prs.skill_id FROM project_required_skills prs WHERE prs.project_id = :projectId)',
          { projectId },
        )
        .getRawOne<{ count: number }>()
        .then((row) => Number(row?.count ?? 0)),
      this.uow.projectMembers.countActiveTotalByProjectIds([projectId]),
      this.uow.projectApplications.existsActiveByConsultantAndProject(consultantId, projectId),
      this.uow.projectInterviewQuestions
        .createQueryBuilder('q')
        .select('1', 'present')
        .where('q.project_id = :projectId', { projectId })
        .andWhere('q.deleted_at IS NULL')
        .limit(1)
        .getRawOne<{ present: number }>()
        .then((row) => row !== undefined),
      this.countActiveMemberships(consultantId),
    ]);

    const matchRate = this.computeMatchRate(requiredCount, matchedCount);
    const isAvailable = this.computeIsAvailable(
      project.status,
      memberCount,
      project.requiredConsultants,
      isApplied,
      activeMembershipCount,
    );

    this.logger.log(
      `getDetail — complete | projectId: ${projectId}, matchRate: ${matchRate}, isApplied: ${isApplied}`,
    );

    return plainToInstance(
      ConsultantProjectDetailResponseDto,
      {
        id: project.id,
        title: project.title,
        company_name: businessProfile?.companyName ?? '',
        introduction: project.introduction,
        is_available_to_apply: isAvailable,
        match_rate: matchRate,
        payment_type: project.paymentType,
        is_need_interview: hasInterview,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private toListItem(
    project: Project,
    businessProfile: { companyName: string; isPartnerPlatform: boolean } | undefined,
    requiredCount: number,
    matchedCount: number,
    avgPrice: number | null,
    memberCount: number,
    isApplied: boolean,
    activeMembershipCount: number,
  ): ConsultantProjectListItemResponseDto {
    const matchRate = this.computeMatchRate(requiredCount, matchedCount);
    const isAvailable = this.computeIsAvailable(
      project.status,
      memberCount,
      project.requiredConsultants,
      isApplied,
      activeMembershipCount,
    );

    return plainToInstance(
      ConsultantProjectListItemResponseDto,
      {
        id: project.id,
        title: project.title,
        company_name: businessProfile?.companyName ?? '',
        is_available_to_apply: isAvailable,
        match_rate: matchRate,
        is_platform_partner: businessProfile?.isPartnerPlatform ?? false,
        avg_price_per_task: project.paymentType === ProjectPaymentType.PER_MONTH ? null : avgPrice,
        payment_type: project.paymentType,
        is_applied: isApplied,
      },
      { excludeExtraneousValues: true },
    );
  }

  private computeMatchRate(requiredCount: number, matchedCount: number): number {
    if (requiredCount <= 0) return 0;
    return Math.round((matchedCount / requiredCount) * 100);
  }

  // Eligibility flag the discovery feed surfaces. The "applied" predicate
  // means the consultant has a non-terminal application (PENDING|ACCEPTED).
  private computeIsAvailable(
    status: ProjectStatus,
    memberCount: number,
    requiredConsultants: number,
    isApplied: boolean,
    activeMembershipCount: number,
  ): boolean {
    if (status !== ProjectStatus.PUBLISHED && status !== ProjectStatus.IN_PROGRESS) return false;
    if (memberCount >= requiredConsultants) return false;
    if (isApplied) return false;
    if (activeMembershipCount >= MAX_CONCURRENT_PROJECTS) return false;
    return true;
  }

  private async loadBusinessProfilesById(
    businessIds: string[],
  ): Promise<Map<string, { companyName: string; isPartnerPlatform: boolean }>> {
    if (businessIds.length === 0) return new Map();
    const profiles = await this.uow.businessProfiles.find({
      where: { id: In(businessIds) },
    });
    const out = new Map<string, { companyName: string; isPartnerPlatform: boolean }>();
    for (const p of profiles) {
      out.set(p.id, { companyName: p.companyName, isPartnerPlatform: p.isPartnerPlatform });
    }
    return out;
  }

  // For each project, count how many of its required skills the consultant
  // owns. Single round-trip via grouped JOIN.
  private async countMatchedSkillsByProject(
    projectIds: string[],
    consultantId: string,
  ): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.projectRequiredSkills
      .createQueryBuilder('prs')
      .innerJoin(
        'consultant_skills',
        'cs',
        'cs.skill_id = prs.skill_id AND cs.consultant_id = :consultantId',
        { consultantId },
      )
      .select('prs.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('prs.project_id IN (:...projectIds)', { projectIds })
      .groupBy('prs.project_id')
      .getRawMany<{ project_id: string; count: number }>();

    const out = new Map<string, number>();
    for (const row of rows) out.set(row.project_id, Number(row.count));
    return out;
  }

  // Counts the consultant's currently-active memberships across all projects
  // — used to gate `is_available_to_apply`.
  private async countActiveMemberships(consultantId: string): Promise<number> {
    return this.uow.projectMembers.count({
      where: {
        consultantId,
        status: ProjectMemberStatus.ACTIVE,
      },
    });
  }

  // Counts required skills per project in a single round-trip.
  private async countRequiredSkillsByProject(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.projectRequiredSkills
      .createQueryBuilder('prs')
      .select('prs.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('prs.project_id IN (:...projectIds)', { projectIds })
      .groupBy('prs.project_id')
      .getRawMany<{ project_id: string; count: number }>();
    const out = new Map<string, number>();
    for (const row of rows) out.set(row.project_id, Number(row.count));
    return out;
  }
}
