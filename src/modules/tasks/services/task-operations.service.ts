import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Task } from '@database/entities';
import {
  BusinessTransactionType,
  ConsultantTransactionType,
  ProjectMemberStatus,
  ProjectStatus,
  TaskKanbanStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  AssignTaskDto,
  CreateTaskDto,
  ReorderTasksDto,
  UpdateTaskBusinessStatusDto,
  UpdateTaskConsultantStatusDto,
} from '../dto/requests';
import { ConsultantTaskResponseDto, TaskResponseDto } from '../dto/responses';
import { ITaskOperationsService } from '../interfaces/task-operations.service.interface';

/** Allowed consultant-driven status transitions. */
const CONSULTANT_TRANSITIONS = new Map<TaskKanbanStatus, TaskKanbanStatus[]>([
  [TaskKanbanStatus.ASSIGNED, [TaskKanbanStatus.IN_PROGRESS]],
  [TaskKanbanStatus.IN_PROGRESS, [TaskKanbanStatus.IN_REVIEW]],
  [TaskKanbanStatus.REVISION_REQUESTED, [TaskKanbanStatus.IN_PROGRESS]],
]);

@Injectable()
export class TaskOperationsService implements ITaskOperationsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(TaskOperationsService.name, requestContext);
  }

  /** @inheritdoc */
  public async createDraftTask(dto: CreateTaskDto): Promise<TaskResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`createDraftTask — start | projectId: ${dto.projectId}`);

    const project = await this.uow.projects.findByIdAndBusinessId(dto.projectId, businessId);
    if (!project) {
      throw this.projectNotFound(dto.projectId, businessId);
    }

    if (project.status !== ProjectStatus.IN_PROGRESS) {
      this.logger.warn(
        `createDraftTask — project not in_progress | projectId: ${dto.projectId}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.project_not_in_progress',
        errorCode: ERROR_CODES.TASK_PROJECT_NOT_IN_PROGRESS,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    const task = this.uow.tasks.create({
      projectId: dto.projectId,
      title: dto.title,
      description: dto.description ?? null,
      price: dto.price,
      difficultyLevel: dto.difficultyLevel,
      kanbanStatus: TaskKanbanStatus.DRAFT,
    });
    const saved = await this.uow.tasks.save(task);

    this.logger.log(`createDraftTask — complete | taskId: ${saved.id}`);
    return this.toResponseDto(saved);
  }

  /** @inheritdoc */
  public async updateBusinessStatus(
    taskId: string,
    dto: UpdateTaskBusinessStatusDto,
  ): Promise<TaskResponseDto> {
    const businessProfile = await this.resolveBusinessProfile();
    this.logger.log(`updateBusinessStatus — start | taskId: ${taskId}, target: ${dto.status}`);

    const task = await this.findTaskOwnedByBusiness(taskId, businessProfile.id);

    // Business cannot set status back to draft
    if (dto.status === TaskKanbanStatus.DRAFT) {
      throw new TranslatableException({
        messageKey: 'error.task.invalid_status_transition',
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // ── draft → to_do: payment gate ──
    if (task.kanbanStatus === TaskKanbanStatus.DRAFT && dto.status === TaskKanbanStatus.TO_DO) {
      const saved = await this.handleDraftToTodo(task, businessProfile);
      this.logger.log(`updateBusinessStatus — draft→to_do complete | taskId: ${taskId}`);
      return this.toResponseDto(saved);
    }

    // ── any → done: consultant payout ──
    if (dto.status === TaskKanbanStatus.DONE) {
      const saved = await this.handleTaskDone(task, businessProfile);
      this.logger.log(`updateBusinessStatus — →done complete | taskId: ${taskId}`);
      return this.toResponseDto(saved);
    }

    // ── All other transitions ──
    task.kanbanStatus = dto.status;
    const saved = await this.uow.tasks.save(task);

    this.logger.log(
      `updateBusinessStatus — complete | taskId: ${taskId}, status: ${saved.kanbanStatus}`,
    );
    return this.toResponseDto(saved);
  }

  /** @inheritdoc */
  public async updateConsultantStatus(
    taskId: string,
    dto: UpdateTaskConsultantStatusDto,
  ): Promise<TaskResponseDto> {
    const consultantProfile = await this.resolveConsultantProfile();
    this.logger.log(`updateConsultantStatus — start | taskId: ${taskId}, target: ${dto.status}`);

    const task = await this.uow.tasks.findOne({ where: { id: taskId } });
    if (!task) {
      throw this.taskNotFound(taskId);
    }

    // Consultant must be the one assigned to the task
    if (task.assignedTo !== consultantProfile.id) {
      this.logger.warn(
        `updateConsultantStatus — not assigned | taskId: ${taskId}, assignedTo: ${task.assignedTo}, consultantId: ${consultantProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.invalid_status_transition',
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.FORBIDDEN,
      });
    }

    const allowed = CONSULTANT_TRANSITIONS.get(task.kanbanStatus);
    if (!allowed || !allowed.includes(dto.status)) {
      this.logger.warn(
        `updateConsultantStatus — invalid transition | taskId: ${taskId}, from: ${task.kanbanStatus}, to: ${dto.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.invalid_status_transition',
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    task.kanbanStatus = dto.status;
    const saved = await this.uow.tasks.save(task);

    this.logger.log(
      `updateConsultantStatus — complete | taskId: ${taskId}, status: ${saved.kanbanStatus}`,
    );
    return this.toResponseDto(saved);
  }

  /** @inheritdoc */
  public async claimTask(taskId: string): Promise<TaskResponseDto> {
    const consultantProfile = await this.resolveConsultantProfile();
    this.logger.log(`claimTask — start | taskId: ${taskId}, consultantId: ${consultantProfile.id}`);

    const saved = await this.uow.withTransaction(async (txUow) => {
      // Race-free claim via FOR UPDATE SKIP LOCKED
      const task = await txUow.tasks
        .createQueryBuilder('task')
        .setLock('pessimistic_write_or_fail')
        .where('task.id = :taskId', { taskId })
        .andWhere('task.kanban_status = :status', { status: TaskKanbanStatus.TO_DO })
        .andWhere('task.assigned_to IS NULL')
        .getOne();

      if (!task) {
        throw new TranslatableException({
          messageKey: 'error.task.not_found',
          errorCode: ERROR_CODES.TASK_ALREADY_ASSIGNED,
          status: HttpStatus.CONFLICT,
        });
      }

      // Verify consultant is an ACTIVE project member
      await this.verifyProjectMembership(task.projectId, consultantProfile.id);

      task.assignedTo = consultantProfile.id;
      task.assignedAt = new Date();
      task.kanbanStatus = TaskKanbanStatus.ASSIGNED;
      return txUow.tasks.save(task);
    });

    this.logger.log(
      `claimTask — complete | taskId: ${taskId}, consultantId: ${consultantProfile.id}`,
    );
    return this.toResponseDto(saved);
  }

  /** @inheritdoc */
  public async assignTask(taskId: string, dto: AssignTaskDto): Promise<TaskResponseDto> {
    const businessProfile = await this.resolveBusinessProfile();
    this.logger.log(`assignTask — start | taskId: ${taskId}, consultantId: ${dto.consultantId}`);

    const task = await this.findTaskOwnedByBusiness(taskId, businessProfile.id);

    if (task.kanbanStatus !== TaskKanbanStatus.TO_DO || task.assignedTo !== null) {
      this.logger.warn(
        `assignTask — task not assignable | taskId: ${taskId}, status: ${task.kanbanStatus}, assignedTo: ${task.assignedTo}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.already_assigned',
        errorCode: ERROR_CODES.TASK_ALREADY_ASSIGNED,
        status: HttpStatus.CONFLICT,
      });
    }

    await this.verifyProjectMembership(task.projectId, dto.consultantId);

    task.assignedTo = dto.consultantId;
    task.assignedAt = new Date();
    task.kanbanStatus = TaskKanbanStatus.ASSIGNED;
    const saved = await this.uow.tasks.save(task);

    this.logger.log(`assignTask — complete | taskId: ${taskId}, consultantId: ${dto.consultantId}`);
    return this.toResponseDto(saved);
  }

  /** @inheritdoc */
  public async listProjectTasks(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskResponseDto>> {
    const [tasks, itemCount] = await this.uow.tasks.findAndCount({
      where: { projectId },
      skip: pageOptions.skip,
      take: pageOptions.limit,
      order: { displayOrder: 'ASC' },
    });

    const data = tasks.map((t) => this.toResponseDto(t));
    const meta = new PageMetaDto({ pageOptionsDto: pageOptions, itemCount });
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async reorderTasks(dto: ReorderTasksDto): Promise<void> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`reorderTasks — start | count: ${dto.tasks.length}`);

    const ids = dto.tasks.map((t) => t.id);
    const tasks = await this.uow.tasks.find({
      where: ids.map((id) => ({ id })),
      relations: { project: true },
    });

    if (tasks.length !== ids.length) {
      throw this.taskNotFound('one or more tasks');
    }

    for (const task of tasks) {
      if (task.project.businessId !== businessId) {
        throw this.taskNotFound(task.id);
      }
    }

    await this.uow.withTransaction(async (txUow) => {
      for (const item of dto.tasks) {
        await txUow.tasks.update(item.id, { displayOrder: item.displayOrder });
      }
    });

    this.logger.log(`reorderTasks — complete | count: ${dto.tasks.length}`);
  }

  /** @inheritdoc */
  public async listProjectTasksForConsultant(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ConsultantTaskResponseDto>> {
    const consultantProfile = await this.resolveConsultantProfile();
    this.logger.log(
      `listProjectTasksForConsultant — start | projectId: ${projectId}, consultantId: ${consultantProfile.id}`,
    );

    await this.verifyProjectMembership(projectId, consultantProfile.id);

    const [tasks, itemCount] = await this.uow.tasks.findAndCount({
      where: { projectId },
      order: { displayOrder: 'ASC' },
      skip: pageOptions.skip,
      take: pageOptions.limit,
    });

    const data = tasks.map((t) =>
      plainToInstance(
        ConsultantTaskResponseDto,
        {
          id: t.id,
          project_id: t.projectId,
          title: t.title,
          description: t.description,
          difficulty_level: t.difficultyLevel,
          kanban_status: t.kanbanStatus,
          assigned_to: t.assignedTo,
          assigned_at: t.assignedAt,
          display_order: t.displayOrder,
          created_at: t.createdAt,
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: pageOptions, itemCount });
    this.logger.log(
      `listProjectTasksForConsultant — complete | projectId: ${projectId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Payment gate: pre-paid businesses pay task.price; credit businesses pass
   * through freely.
   */
  private async handleDraftToTodo(
    task: Task,
    businessProfile: { id: string; allowPaymentCredit: boolean; accountBalance: string },
  ): Promise<Task> {
    return this.uow.withTransaction(async (txUow) => {
      if (!businessProfile.allowPaymentCredit) {
        const balance = parseFloat(businessProfile.accountBalance);
        const price = Number(task.price);

        if (balance < price) {
          throw new TranslatableException({
            messageKey: 'error.payment.insufficient_balance',
            errorCode: ERROR_CODES.PAYMENT_INSUFFICIENT_BALANCE,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }

        businessProfile.accountBalance = (balance - price).toFixed(2);
        await txUow.businessProfiles.save(businessProfile);

        const txn = txUow.businessTransactions.create({
          businessId: businessProfile.id,
          type: BusinessTransactionType.TASK_ADDED,
          amount: price.toFixed(2),
          status: TransactionStatus.COMPLETED,
          taskId: task.id,
          projectId: task.projectId,
          note: `Task added to kanban: ${task.title}`,
        });
        await txUow.businessTransactions.save(txn);
      }

      task.kanbanStatus = TaskKanbanStatus.TO_DO;
      return txUow.tasks.save(task);
    });
  }

  /**
   * Marks task done and handles consultant payout:
   * - Pre-paid: immediate credit to consultant balance
   * - Credit: pending credit settled on 5th of month
   */
  private async handleTaskDone(
    task: Task,
    businessProfile: { id: string; allowPaymentCredit: boolean },
  ): Promise<Task> {
    const userId = this.requestContext.userId!;

    return this.uow.withTransaction(async (txUow) => {
      task.kanbanStatus = TaskKanbanStatus.DONE;
      task.approvedBy = userId;
      task.approvedAt = new Date();

      if (task.assignedTo) {
        const consultantProfile = await txUow.consultantProfiles.findOne({
          where: { id: task.assignedTo },
        });

        if (consultantProfile) {
          const payoutAmount = Number(task.consultantPayout);

          if (!businessProfile.allowPaymentCredit) {
            // Pre-paid: immediate credit
            consultantProfile.accountBalance = (
              parseFloat(consultantProfile.accountBalance) + payoutAmount
            ).toFixed(2);
            await txUow.consultantProfiles.save(consultantProfile);

            const txn = txUow.consultantTransactions.create({
              consultantId: consultantProfile.id,
              type: ConsultantTransactionType.CREDIT_CLEARED,
              amount: payoutAmount.toFixed(2),
              status: TransactionStatus.COMPLETED,
              taskId: task.id,
              projectId: task.projectId,
              note: `Task completed: ${task.title}`,
            });
            await txUow.consultantTransactions.save(txn);
          } else {
            // Credit: pending — settled on 5th of month
            const txn = txUow.consultantTransactions.create({
              consultantId: consultantProfile.id,
              type: ConsultantTransactionType.CREDIT_PENDING,
              amount: payoutAmount.toFixed(2),
              status: TransactionStatus.PENDING,
              taskId: task.id,
              projectId: task.projectId,
              note: `Task completed (pending settlement): ${task.title}`,
            });
            await txUow.consultantTransactions.save(txn);
          }
        }
      }

      return txUow.tasks.save(task);
    });
  }

  private async resolveBusinessId(): Promise<string> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);
    if (!profile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return profile.id;
  }

  private async resolveBusinessProfile(): Promise<{
    id: string;
    allowPaymentCredit: boolean;
    accountBalance: string;
  }> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);
    if (!profile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return profile;
  }

  private async resolveConsultantProfile(): Promise<{ id: string }> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return profile;
  }

  private async findTaskOwnedByBusiness(taskId: string, businessId: string): Promise<Task> {
    const task = await this.uow.tasks.findOne({
      where: { id: taskId },
      relations: { project: true },
    });

    if (!task || task.project.businessId !== businessId) {
      throw this.taskNotFound(taskId);
    }

    return task;
  }

  private async verifyProjectMembership(projectId: string, consultantId: string): Promise<void> {
    const member = await this.uow.projectMembers.findOne({
      where: {
        projectId,
        consultantId,
        status: ProjectMemberStatus.ACTIVE,
      },
    });

    if (!member) {
      throw new TranslatableException({
        messageKey: 'error.task.consultant_not_project_member',
        errorCode: ERROR_CODES.TASK_CONSULTANT_NOT_PROJECT_MEMBER,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
  }

  private projectNotFound(projectId: string, businessId: string): TranslatableException {
    this.logger.warn(
      `task operation — project not found | projectId: ${projectId}, businessId: ${businessId}`,
    );
    return new TranslatableException({
      messageKey: 'error.project.not_found',
      errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private taskNotFound(taskId: string): TranslatableException {
    this.logger.warn(`task operation — task not found | taskId: ${taskId}`);
    return new TranslatableException({
      messageKey: 'error.task.not_found',
      errorCode: ERROR_CODES.TASK_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private toResponseDto(task: Task): TaskResponseDto {
    return plainToInstance(
      TaskResponseDto,
      {
        id: task.id,
        project_id: task.projectId,
        title: task.title,
        description: task.description,
        price: task.price,
        platform_fee_amount: task.platformFeeAmount,
        consultant_payout: task.consultantPayout,
        difficulty_level: task.difficultyLevel,
        kanban_status: task.kanbanStatus,
        assigned_to: task.assignedTo,
        assigned_at: task.assignedAt,
        approved_by: task.approvedBy,
        approved_at: task.approvedAt,
        display_order: task.displayOrder,
        created_at: task.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
