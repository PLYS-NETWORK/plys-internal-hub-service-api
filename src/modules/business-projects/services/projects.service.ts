import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import {
  ApplicationStatus,
  ProjectMemberStatus,
  ProjectStatus,
  TaskKanbanStatus,
} from '@database/enums';
import { BusinessProjectService } from '@modules/projects/services/business-project.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ILike } from 'typeorm';

import { CreateProjectDto, ListProjectsDto } from '../dto/requests';
import {
  ProjectListItemResponseDto,
  ProjectSummaryResponseDto,
  PublishValidationResponseDto,
} from '../dto/responses';
import { IBusinessProjectsService } from '../interfaces/projects.service.interface';
import { BusinessAccessService } from './business-access.service';

@Injectable()
export class BusinessProjectsService implements IBusinessProjectsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    // Reused from the legacy projects module for the publish flow. Until the
    // legacy module is decommissioned this delegation avoids a 200-line copy
    // of the wallet/commission settlement logic — when legacy goes, the publish
    // body should be inlined here.
    private readonly legacyBusinessProjects: BusinessProjectService,
  ) {
    this.logger = new AppLogger(BusinessProjectsService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async createProject(dto: CreateProjectDto): Promise<ProjectSummaryResponseDto> {
    const { id: businessId } = await this.access.resolveBusinessProfile();
    this.logger.log(
      `[${this.rid}] createProject — start | businessId: ${businessId}, title: ${dto.title}`,
    );

    const project = this.uow.projects.create({
      businessId,
      title: dto.title,
      introduction: dto.introduction ?? null,
      status: ProjectStatus.DRAFT,
      requiredConsultants: 1,
    });
    const saved = await this.uow.projects.save(project);

    this.logger.log(`[${this.rid}] createProject — complete | projectId: ${saved.id}`);
    return this.toSummaryResponseDto(saved);
  }

  /** @inheritdoc */
  public async listMyProjects(dto: ListProjectsDto): Promise<PageDto<ProjectListItemResponseDto>> {
    const { id: businessId } = await this.access.resolveBusinessProfile();
    this.logger.log(
      `[${this.rid}] listMyProjects — start | businessId: ${businessId}, page: ${dto.page}, limit: ${dto.limit}, keywords: ${dto.keywords ?? '<none>'}`,
    );

    const where: Record<string, unknown> = { businessId };
    if (dto.keywords) where.title = ILike(`%${dto.keywords}%`);

    const [projects, itemCount] = await this.uow.projects.findAndCount({
      where,
      order: { [dto.sort_by ?? 'createdAt']: dto.order_by ?? 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const projectIds = projects.map((p) => p.id);
    const [taskCounts, memberCounts, applicationCounts] = await Promise.all([
      this.countTasksPerProject(projectIds),
      this.countActiveMembersPerProject(projectIds),
      this.countPendingApplicationsPerProject(projectIds),
    ]);

    const data = projects.map((p) =>
      plainToInstance(
        ProjectListItemResponseDto,
        {
          id: p.id,
          title: p.title,
          status: p.status,
          created_at: p.createdAt,
          published_at: p.publishedAt,
          required_consultants: p.requiredConsultants,
          total_tasks: taskCounts.get(p.id) ?? 0,
          total_active_members: memberCounts.get(p.id) ?? 0,
          total_pending_applications: applicationCounts.get(p.id) ?? 0,
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });
    this.logger.log(
      `[${this.rid}] listMyProjects — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async validatePublish(projectId: string): Promise<PublishValidationResponseDto> {
    const { id: businessId } = await this.access.resolveBusinessProfile();
    this.logger.log(
      `[${this.rid}] validatePublish — start | projectId: ${projectId}, businessId: ${businessId}`,
    );
    await this.access.resolveOwnedProject(projectId);

    // Delegate to legacy — it implements the same business contract today.
    const legacyResponse = await this.legacyBusinessProjects.validatePublish(projectId);

    this.logger.log(
      `[${this.rid}] validatePublish — complete | projectId: ${projectId}, can_publish: ${legacyResponse.can_publish}`,
    );

    // Legacy uses `'pre-paid'`; the new module's contract uses the snake_case
    // `'pre_paid'` enum value. Rewrite on the wire.
    return plainToInstance(
      PublishValidationResponseDto,
      {
        ...legacyResponse,
        payment_type: legacyResponse.payment_type === 'credit' ? 'credit' : 'pre_paid',
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async confirmPublish(projectId: string): Promise<void> {
    const { id: businessId } = await this.access.resolveBusinessProfile();
    this.logger.log(
      `[${this.rid}] confirmPublish — start | projectId: ${projectId}, businessId: ${businessId}`,
    );
    await this.access.resolveOwnedProject(projectId);

    // Delegate to legacy — wallet lock + balance check + transaction insert
    // + status flip all happen inside the legacy `withTransaction` block.
    await this.legacyBusinessProjects.confirmPublish(projectId);

    this.logger.log(`[${this.rid}] confirmPublish — complete | projectId: ${projectId}`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async countTasksPerProject(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.tasks
      .createQueryBuilder('t')
      .select('t.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('t.project_id IN (:...projectIds)', { projectIds })
      .andWhere('t.kanban_status != :draft', { draft: TaskKanbanStatus.DRAFT })
      .andWhere('t.deleted_at IS NULL')
      .groupBy('t.project_id')
      .getRawMany<{ project_id: string; count: number }>();
    return new Map(rows.map((r) => [r.project_id, Number(r.count)]));
  }

  private async countActiveMembersPerProject(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.projectMembers
      .createQueryBuilder('pm')
      .select('pm.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('pm.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pm.status = :active', { active: ProjectMemberStatus.ACTIVE })
      .groupBy('pm.project_id')
      .getRawMany<{ project_id: string; count: number }>();
    return new Map(rows.map((r) => [r.project_id, Number(r.count)]));
  }

  private async countPendingApplicationsPerProject(
    projectIds: string[],
  ): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.projectApplications
      .createQueryBuilder('pa')
      .select('pa.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('pa.project_id IN (:...projectIds)', { projectIds })
      .andWhere('pa.status = :pending', { pending: ApplicationStatus.PENDING })
      .groupBy('pa.project_id')
      .getRawMany<{ project_id: string; count: number }>();
    return new Map(rows.map((r) => [r.project_id, Number(r.count)]));
  }

  private toSummaryResponseDto(project: {
    id: string;
    title: string;
    introduction: Record<string, unknown> | null;
    status: ProjectStatus;
    requiredConsultants: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectSummaryResponseDto {
    return plainToInstance(
      ProjectSummaryResponseDto,
      {
        id: project.id,
        title: project.title,
        introduction: project.introduction,
        status: project.status,
        required_consultants: project.requiredConsultants,
        published_at: project.publishedAt,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
