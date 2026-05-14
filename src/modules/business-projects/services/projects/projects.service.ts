import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import {
  ProjectMemberStatus,
  ProjectPaymentType,
  ProjectStatus,
  TaskKanbanStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ILike } from 'typeorm';

import { CreateProjectDto, ListProjectsDto, SearchProjectsDto } from '../../dto/requests';
import { TransitionProjectStatusDto } from '../../dto/requests/transition-project-status.dto';
import {
  ProjectListItemResponseDto,
  ProjectSearchItemResponseDto,
  ProjectSummaryResponseDto,
} from '../../dto/responses';
import { IBusinessProjectsService } from '../../interfaces/projects.service.interface';
import { BusinessAccessService } from '../business-access.service';

// Pre-publish statuses where a project still has no financial / member
// commitments and can be safely soft-deleted. Anything past `CONFIGURED`
// (i.e. `PUBLISHED`, `IN_PROGRESS`, `DONE`, `CANCELLED`) must be cancelled
// through the dedicated lifecycle flow instead.
const DELETABLE_STATUSES = new Set<ProjectStatus>([ProjectStatus.DRAFT, ProjectStatus.CONFIGURED]);

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

  /** @inheritdoc */
  public async createProject(dto: CreateProjectDto): Promise<ProjectSummaryResponseDto> {
    const { id: businessId } = await this.access.resolveBusinessProfile();
    this.logger.log(
      `createProject — start | businessId: ${businessId}, code: ${dto.code}, title: ${dto.title}`,
    );

    const existing = await this.uow.projects.findOne({
      where: { businessId, code: dto.code },
    });
    if (existing) {
      this.logger.warn(
        `createProject — code already exists | businessId: ${businessId}, code: ${dto.code}`,
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
      requiredConsultants: 0,
    });
    const saved = await this.uow.projects.save(project);

    this.logger.log(`createProject — complete | projectId: ${saved.id}`);
    return this.toSummaryResponseDto(saved);
  }

  /** @inheritdoc */
  public async listMyProjects(dto: ListProjectsDto): Promise<PageDto<ProjectListItemResponseDto>> {
    const { id: businessId } = await this.access.resolveBusinessProfile();
    this.logger.log(
      `listMyProjects — start | businessId: ${businessId}, page: ${dto.page}, limit: ${dto.limit}, keywords: ${dto.keywords ?? '<none>'}`,
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
    const [taskCounts, memberCounts] = await Promise.all([
      this.countTasksPerProject(projectIds),
      this.countActiveMembersPerProject(projectIds),
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
        },
        { excludeExtraneousValues: true },
      );
    });

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });
    this.logger.log(`listMyProjects — complete | returned: ${data.length}, total: ${itemCount}`);
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async searchMyProjects(
    dto: SearchProjectsDto,
  ): Promise<PageDto<ProjectSearchItemResponseDto>> {
    const { id: businessId } = await this.access.resolveBusinessProfile();
    this.logger.log(
      `searchMyProjects — start | businessId: ${businessId}, page: ${dto.page}, limit: ${dto.limit}, keywords: ${dto.keywords ?? '<none>'}`,
    );

    // Query builder (not findAndCount) so we can OR across title + code in a
    // single ILIKE clause — see board.service.ts for the same pattern. The
    // explicit `deleted_at IS NULL` mirrors TypeORM's soft-delete auto-filter
    // that find* methods apply but the builder does not.
    const qb = this.uow.projects
      .createQueryBuilder('p')
      .where('p.business_id = :businessId', { businessId })
      .andWhere('p.deleted_at IS NULL');

    if (dto.keywords) {
      qb.andWhere('(p.title ILIKE :kw OR p.code ILIKE :kw)', { kw: `%${dto.keywords}%` });
    }

    qb.orderBy('p.created_at', 'DESC').skip(dto.skip).take(dto.limit);

    const [projects, itemCount] = await qb.getManyAndCount();

    const data = projects.map((p) =>
      plainToInstance(
        ProjectSearchItemResponseDto,
        { id: p.id, code: p.code, title: p.title },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });
    this.logger.log(`searchMyProjects — complete | returned: ${data.length}, total: ${itemCount}`);
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async deleteProject(projectId: string): Promise<void> {
    this.logger.log(`deleteProject — start | projectId: ${projectId}`);
    const { project } = await this.access.resolveOwnedProject(projectId);

    if (!DELETABLE_STATUSES.has(project.status)) {
      this.logger.warn(
        `deleteProject — status not deletable | projectId: ${projectId}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.cannot_be_deleted',
        errorCode: ERROR_CODES.PROJECT_CANNOT_BE_DELETED,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Soft delete via AuditableEntity columns. AuditSubscriber stamps
    // deleted_by / deleted_at automatically. Child rows (tasks, interview
    // questions, required skills) stay in place — their CASCADE FKs only
    // fire on a hard delete, and existing read paths already filter
    // soft-deleted projects out via `deleted_at IS NULL`.
    await this.uow.projects.softDelete({ id: project.id });
    this.logger.log(`deleteProject — complete | projectId: ${project.id}`);
  }

  /** @inheritdoc */
  public async transitionStatus(
    projectId: string,
    dto: TransitionProjectStatusDto,
  ): Promise<ProjectSummaryResponseDto> {
    this.logger.log(`transitionStatus — start | projectId: ${projectId}, target: ${dto.status}`);
    const { project } = await this.access.resolveOwnedProject(projectId);

    // Guard: only `draft → configured` accepted via this endpoint. Anything
    // else (publish, start, cancel) is a different lifecycle flow.
    if (project.status !== ProjectStatus.DRAFT) {
      this.logger.warn(
        `transitionStatus — refused | projectId: ${projectId}, current: ${project.status}, target: ${dto.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.invalid_status_transition',
        errorCode: ERROR_CODES.PROJECT_INVALID_STATUS_TRANSITION,
        status: HttpStatus.CONFLICT,
      });
    }

    // Price gate. Drafts with `price = 0` are placeholders the AI / user
    // hasn't sized yet; publishing them would charge nothing and break the
    // payout invariant. Surface the offending IDs so the FE can scroll to
    // them in the backlog UI.
    const offending = await this.uow.tasks
      .createQueryBuilder('t')
      .select('t.id', 'id')
      .where('t.project_id = :projectId', { projectId })
      .andWhere('t.kanban_status = :draft', { draft: TaskKanbanStatus.DRAFT })
      .andWhere('t.price = 0')
      .andWhere('t.deleted_at IS NULL')
      .getRawMany<{ id: string }>();

    if (offending.length > 0) {
      const offendingIds = offending.map((row) => row.id);
      this.logger.warn(
        `transitionStatus — price gate failed | projectId: ${projectId}, count: ${offendingIds.length}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project_status.price_gate_failed',
        errorCode: ERROR_CODES.PROJECT_PRICE_GATE_FAILED,
        status: HttpStatus.CONFLICT,
        args: { count: offendingIds.length },
        details: { offending_task_ids: offendingIds },
      });
    }

    project.status = ProjectStatus.CONFIGURED;
    const saved = await this.uow.projects.save(project);

    this.logger.log(
      `transitionStatus — complete | projectId: ${projectId}, status: ${saved.status}`,
    );
    return this.toSummaryResponseDto(saved);
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
