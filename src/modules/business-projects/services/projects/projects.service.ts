import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import {
  ApplicationStatus,
  ProjectMemberStatus,
  ProjectPaymentType,
  ProjectStatus,
  TaskKanbanStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ILike } from 'typeorm';

import { CreateProjectDto, ListProjectsDto } from '../../dto/requests';
import { ProjectListItemResponseDto, ProjectSummaryResponseDto } from '../../dto/responses';
import { IBusinessProjectsService } from '../../interfaces/projects.service.interface';
import { BusinessAccessService } from '../business-access.service';

@Injectable()
export class BusinessProjectsService implements IBusinessProjectsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
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
      `[${this.rid}] createProject — start | businessId: ${businessId}, code: ${dto.code}, title: ${dto.title}`,
    );

    const existing = await this.uow.projects.findOne({
      where: { businessId, code: dto.code },
    });
    if (existing) {
      this.logger.warn(
        `[${this.rid}] createProject — code already exists | businessId: ${businessId}, code: ${dto.code}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.code_already_exists',
        errorCode: ERROR_CODES.PROJECT_CODE_ALREADY_EXISTS,
        status: HttpStatus.CONFLICT,
      });
    }

    const project = this.uow.projects.create({
      businessId,
      code: dto.code,
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

    const data = projects.map((p) => {
      const tasks = taskCounts.get(p.id);
      return plainToInstance(
        ProjectListItemResponseDto,
        {
          id: p.id,
          code: p.code,
          title: p.title,
          status: p.status,
          payment_type: p.paymentType,
          created_at: p.createdAt,
          published_at: p.publishedAt,
          required_consultants: p.requiredConsultants,
          total_tasks: tasks?.total ?? 0,
          total_completed_tasks: tasks?.completed ?? 0,
          total_active_members: memberCounts.get(p.id) ?? 0,
          total_pending_applications: applicationCounts.get(p.id) ?? 0,
        },
        { excludeExtraneousValues: true },
      );
    });

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });
    this.logger.log(
      `[${this.rid}] listMyProjects — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async countTasksPerProject(
    projectIds: string[],
  ): Promise<Map<string, { total: number; completed: number }>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.tasks
      .createQueryBuilder('t')
      .select('t.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect('COUNT(*) FILTER (WHERE t.kanban_status = :done)::int', 'completed')
      .where('t.project_id IN (:...projectIds)', { projectIds })
      .andWhere('t.deleted_at IS NULL')
      .setParameter('done', TaskKanbanStatus.DONE)
      .groupBy('t.project_id')
      .getRawMany<{ project_id: string; total: number; completed: number }>();
    return new Map(
      rows.map((r) => [r.project_id, { total: Number(r.total), completed: Number(r.completed) }]),
    );
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
    code: string;
    title: string;
    introduction: Record<string, unknown> | null;
    status: ProjectStatus;
    paymentType: ProjectPaymentType;
    requiredConsultants: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectSummaryResponseDto {
    return plainToInstance(
      ProjectSummaryResponseDto,
      {
        id: project.id,
        code: project.code,
        title: project.title,
        introduction: project.introduction,
        status: project.status,
        payment_type: project.paymentType,
        required_consultants: project.requiredConsultants,
        published_at: project.publishedAt,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
