import { ProjectAiContextService } from '@modules/project-ai-context/project-ai-context.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageMetaDto } from '@plys/libraries/common-nest/dto/page-meta.dto';
import { NOTIFICATION_EVENTS } from '@plys/libraries/common-nest/events';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Money } from '@plys/libraries/common-nest/utils/money';
import { Project, Task, TaskAttachment } from '@plys/libraries/database/entities';
import {
  BusinessTransactionType,
  PaymentType,
  ProjectStatus,
  TaskCreationMode,
  TaskHistoryChangeType,
  TaskKanbanStatus,
  TransactionStatus,
} from '@plys/libraries/database/enums';
import {
  IBusinessProfileLock,
  IBusinessProfileSnapshot,
  IProfilesLedger,
  PROFILES_LEDGER,
} from '@plys/libraries/profiles-port';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { plainToInstance } from 'class-transformer';
import { ILike, In } from 'typeorm';

import {
  CreateDraftTaskDto,
  ListDraftTasksDto,
  TaskIdsDto,
  UpdateDraftTaskDto,
} from '../dto/requests';
import {
  AiSyncTaskAction,
  AiSyncTaskRowDto,
  AiSyncTasksDto,
} from '../dto/requests/ai-sync-tasks.dto';
import {
  AddToBoardValidationResponseDto,
  DraftTaskResponseDto,
  PayTasksResponseDto,
} from '../dto/responses';
import {
  AiSyncTaskOutcome,
  AiSyncTaskResultDto,
  AiSyncTasksResponseDto,
} from '../dto/responses/ai-sync-tasks-response.dto';
import { IBacklogsService } from '../interfaces/backlogs.service.interface';
import { BusinessAccessService } from './business-access.service';
import { ProjectStatusService } from './projects/project-status.service';

const DEFAULT_COMMISSION_RATE = '0.25';

const ALLOWED_ADD_TO_BOARD_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
]);

// Per-mode action whitelist for AI-sync. Drives the all-or-nothing batch
// validation in `aiSyncTasks` — any row referencing an action outside its
// project's whitelist fails the entire batch (the FE surfaces
// `offending_client_temp_ids` from the error response details).
const AI_SYNC_ALLOWED_ACTIONS_BY_STATUS: Record<ProjectStatus, ReadonlySet<AiSyncTaskAction>> = {
  [ProjectStatus.DRAFT]: new Set<AiSyncTaskAction>(['create', 'update', 'delete']),
  [ProjectStatus.CONFIGURED]: new Set<AiSyncTaskAction>(['create', 'update', 'delete']),
  [ProjectStatus.PUBLISHED]: new Set<AiSyncTaskAction>(['create']),
  [ProjectStatus.IN_PROGRESS]: new Set<AiSyncTaskAction>(['create']),
  [ProjectStatus.DONE]: new Set<AiSyncTaskAction>(),
  [ProjectStatus.CANCELLED]: new Set<AiSyncTaskAction>(),
};

interface PricingBreakdown {
  projectAmount: Money;
  commissionRate: string;
  commissionAmount: Money;
  totalAmount: Money;
  paymentType: PaymentType;
}

@Injectable()
export class BacklogsService implements IBacklogsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    @Inject(PROFILES_LEDGER) private readonly profilesLedger: IProfilesLedger,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly projectStatus: ProjectStatusService,
    private readonly aiContext: ProjectAiContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(BacklogsService.name, requestContext);
  }

  /** @inheritdoc */
  public async createDraftTask(
    projectId: string,
    dto: CreateDraftTaskDto,
  ): Promise<DraftTaskResponseDto> {
    this.logger.log(`createDraftTask — start | projectId: ${projectId}, title: ${dto.title}`);
    const { project } = await this.access.resolveOwnedProject(projectId);

    // Run inside a transaction so the advisory lock from `taskCodes.next` and
    // the subsequent INSERT participate in one atomic unit — concurrent
    // creates on the same project serialise on the lock.
    const savedId = await this.uow.withTransaction(async (tx) => {
      const maxOrder = await tx.tasks
        .createQueryBuilder('t')
        .select('COALESCE(MAX(t.display_order), 0)', 'max_order')
        .where('t.project_id = :projectId', { projectId })
        .andWhere('t.kanban_status = :draft', { draft: TaskKanbanStatus.DRAFT })
        .andWhere('t.deleted_at IS NULL')
        .getRawOne<{ max_order: number }>();

      const { codeSeq, code } = await tx.taskCodes.next(projectId, project.code);

      const task = tx.tasks.create({
        projectId,
        code,
        codeSeq,
        title: dto.title,
        description: dto.description ?? null,
        price: Number(dto.price),
        kanbanStatus: TaskKanbanStatus.DRAFT,
        creationMode: TaskCreationMode.MANUAL,
        displayOrder: Number(maxOrder?.max_order ?? 0) + 1,
      });
      const saved = await tx.tasks.save(task);
      await tx.taskHistory.save(
        tx.taskHistory.create({
          taskId: saved.id,
          changeType: TaskHistoryChangeType.CREATED,
          changedBy: this.requestContext.userId!,
        }),
      );
      await this.projectStatus.recomputeAutoStatus(tx, projectId);
      // Light AI-context update inside the same tx — flips `needs_reindex`
      // when the task is new so the FE re-derives `domain` / summaries.
      await this.aiContext.patchTaskInIndex(tx, projectId, saved);
      return saved.id;
    });

    // Re-read outside the transaction so the STORED generated columns
    // (`platform_fee_amount`, `consultant_payout`) are populated.
    const reloaded = await this.uow.tasks.findOne({ where: { id: savedId } });
    if (!reloaded) {
      // Should be unreachable — we just inserted in a committed transaction.
      throw new Error(`createDraftTask: failed to reload task ${savedId}`);
    }

    this.logger.log(`createDraftTask — complete | taskId: ${reloaded.id}, code: ${reloaded.code}`);
    return this.toDraftTaskResponse(reloaded);
  }

  /** @inheritdoc */
  public async updateDraftTask(
    projectId: string,
    taskId: string,
    dto: UpdateDraftTaskDto,
  ): Promise<DraftTaskResponseDto> {
    this.logger.log(`updateDraftTask — start | projectId: ${projectId}, taskId: ${taskId}`);
    await this.access.resolveOwnedProject(projectId);

    const task = await this.uow.tasks.findOne({
      where: { id: taskId, projectId, kanbanStatus: TaskKanbanStatus.DRAFT },
    });
    if (!task) {
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description ?? null;
    if (dto.price !== undefined) task.price = Number(dto.price);

    // Wrap the save + AI-context patch in a single tx so the index never
    // points at stale title/price for an existing task. `patchTaskInIndex`
    // preserves the FE-supplied `summary` on update.
    const saved = await this.uow.withTransaction(async (tx) => {
      const persisted = await tx.tasks.save(task);
      await tx.taskHistory.save(
        tx.taskHistory.create({
          taskId: persisted.id,
          changeType: TaskHistoryChangeType.EDIT,
          changedBy: this.requestContext.userId!,
        }),
      );
      await this.aiContext.patchTaskInIndex(tx, projectId, persisted);
      return persisted;
    });

    this.logger.log(`updateDraftTask — complete | taskId: ${saved.id}`);
    return this.toDraftTaskResponse(saved);
  }

  /** @inheritdoc */
  public async listDraftTasks(
    projectId: string,
    dto: ListDraftTasksDto,
  ): Promise<PageDto<DraftTaskResponseDto>> {
    this.logger.log(
      `listDraftTasks — start | projectId: ${projectId}, page: ${dto.page}, keywords: ${dto.keywords ?? '<none>'}`,
    );
    await this.access.resolveOwnedProject(projectId);

    const where: Record<string, unknown> = {
      projectId,
      kanbanStatus: TaskKanbanStatus.DRAFT,
    };
    if (dto.keywords) where.title = ILike(`%${dto.keywords}%`);

    const [tasks, itemCount] = await this.uow.tasks.findAndCount({
      where,
      order: { [dto.sort_by ?? 'createdAt']: dto.order_by ?? 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    const taskIds = tasks.map((t) => t.id);
    const allAttachments =
      taskIds.length > 0
        ? await this.uow.taskAttachments.find({
            where: { taskId: In(taskIds) },
            order: { uploadedAt: 'ASC' },
          })
        : [];
    const byTaskId = new Map<string, TaskAttachment[]>();
    for (const a of allAttachments) {
      const arr = byTaskId.get(a.taskId) ?? [];
      arr.push(a);
      byTaskId.set(a.taskId, arr);
    }

    const data = tasks.map((t) => this.toDraftTaskResponse(t, byTaskId.get(t.id) ?? []));
    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listDraftTasks — complete | projectId: ${projectId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async bulkDelete(projectId: string, dto: TaskIdsDto): Promise<void> {
    this.logger.log(`bulkDelete — start | projectId: ${projectId}, count: ${dto.taskIds.length}`);
    await this.access.resolveOwnedProject(projectId);

    await this.uow.withTransaction(async (tx) => {
      const tasks = await tx.tasks.find({
        where: { id: In(dto.taskIds), projectId },
      });
      this.assertAllTasksAreDraft(dto.taskIds, tasks);
      await tx.tasks.delete({ id: In(dto.taskIds) });
      await this.projectStatus.recomputeAutoStatus(tx, projectId);
      // Drop the deleted tasks from `task_index` in the same tx; flips
      // `needs_reindex` so the FE re-derives skill clusters / summaries.
      await this.aiContext.removeManyFromIndex(tx, projectId, dto.taskIds);
    });

    this.logger.log(
      `bulkDelete — complete | projectId: ${projectId}, deleted: ${dto.taskIds.length}`,
    );
  }

  /**
   * AI-sync batch task mutation. Up to 50 rows of `create` / `update` /
   * `delete` applied in a single transaction. Per-mode action whitelist
   * enforced before any write — a single offending row fails the whole
   * batch with 422 + `details: { offending_client_temp_ids }` so the FE
   * can highlight the rows it needs to fix.
   *
   * Per-row contract:
   *   - `create`: must NOT carry `task_id`; `title` and `price` required.
   *     Allocates a fresh code + display_order; `creation_mode = AI_ASSISTED`.
   *   - `update`: `task_id` required; only DRAFT-status tasks may be touched.
   *   - `delete`: `task_id` required; only DRAFT-status tasks may be removed.
   *
   * @returns Per-row outcomes (status + `task_id`) plus the final
   *   auto-recomputed project status.
   * @throws TranslatableException 409 PROJECT_INVALID_STATUS_TRANSITION when
   *   the project is in a terminal status.
   * @throws TranslatableException 422 AI_SYNC_TASK_REJECTED when any row
   *   violates the per-mode action whitelist or the per-row field rules.
   */
  public async aiSyncTasks(
    projectId: string,
    dto: AiSyncTasksDto,
  ): Promise<AiSyncTasksResponseDto> {
    this.logger.log(`aiSyncTasks — start | projectId: ${projectId}, count: ${dto.tasks.length}`);
    const { project } = await this.access.resolveOwnedProject(projectId);
    const allowedActions = AI_SYNC_ALLOWED_ACTIONS_BY_STATUS[project.status];

    // Validate every row up-front so we don't half-write the batch.
    const offendingTempIds: string[] = [];
    for (const row of dto.tasks) {
      const tempId = row.clientTempId ?? row.taskId ?? '<row>';
      if (!allowedActions.has(row.action)) {
        offendingTempIds.push(tempId);
        continue;
      }
      const fieldsValid = this.validateAiSyncRowFields(row);
      if (!fieldsValid) offendingTempIds.push(tempId);
    }
    if (offendingTempIds.length > 0) {
      this.logger.warn(
        `aiSyncTasks — rejected | projectId: ${projectId}, status: ${project.status}, ` +
          `offenders: ${offendingTempIds.length}`,
      );
      throw new TranslatableException({
        messageKey: 'error.ai_sync.task_rejected',
        errorCode: ERROR_CODES.AI_SYNC_TASK_REJECTED,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        args: { count: offendingTempIds.length },
        details: { offending_client_temp_ids: offendingTempIds },
      });
    }

    const result = await this.uow.withTransaction(async (tx) => {
      const results: AiSyncTaskResultDto[] = [];

      // Apply deletes first — they free up display_order slots and let
      // creates use a contiguous range starting from the new max.
      const deleteIds = dto.tasks
        .filter((r) => r.action === 'delete')
        .map((r) => r.taskId as string);
      if (deleteIds.length > 0) {
        const existing = await tx.tasks.find({
          where: { id: In(deleteIds), projectId },
        });
        this.assertAllTasksAreDraft(deleteIds, existing);
        await tx.tasks.delete({ id: In(deleteIds) });
        await this.aiContext.removeManyFromIndex(tx, projectId, deleteIds);
        for (const id of deleteIds) {
          const row = dto.tasks.find((r) => r.action === 'delete' && r.taskId === id);
          results.push(
            plainToInstance(
              AiSyncTaskResultDto,
              {
                client_temp_id: row?.clientTempId ?? null,
                status: 'deleted' satisfies AiSyncTaskOutcome,
                task_id: id,
              },
              { excludeExtraneousValues: true },
            ),
          );
        }
      }

      // Updates next.
      for (const row of dto.tasks) {
        if (row.action !== 'update') continue;
        const task = await tx.tasks.findOne({
          where: {
            id: row.taskId,
            projectId,
            kanbanStatus: TaskKanbanStatus.DRAFT,
          },
        });
        if (!task) {
          // Already validated as draft via mode rules; missing here means a
          // concurrent delete or a non-draft slipped through. Treat as a
          // batch failure to avoid partial application.
          throw new TranslatableException({
            messageKey: 'error.task.not_found',
            errorCode: ERROR_CODES.TASK_NOT_FOUND,
            status: HttpStatus.NOT_FOUND,
            args: { task_id: row.taskId ?? '' },
          });
        }
        if (row.title !== undefined) task.title = row.title;
        if (row.description !== undefined) task.description = row.description ?? null;
        if (row.price !== undefined) task.price = Number(row.price);
        const saved = await tx.tasks.save(task);
        await tx.taskHistory.save(
          tx.taskHistory.create({
            taskId: saved.id,
            changeType: TaskHistoryChangeType.EDIT,
            changedBy: this.requestContext.userId!,
          }),
        );
        await this.aiContext.patchTaskInIndex(tx, projectId, saved);
        results.push(
          plainToInstance(
            AiSyncTaskResultDto,
            {
              client_temp_id: row.clientTempId ?? null,
              status: 'updated' satisfies AiSyncTaskOutcome,
              task_id: saved.id,
            },
            { excludeExtraneousValues: true },
          ),
        );
      }

      // Creates last. Allocate display_order from the post-delete max so
      // the batch lands contiguously at the bottom of the backlog.
      const creates = dto.tasks.filter((r) => r.action === 'create');
      if (creates.length > 0) {
        const maxOrder = await tx.tasks
          .createQueryBuilder('t')
          .select('COALESCE(MAX(t.display_order), 0)', 'max_order')
          .where('t.project_id = :projectId', { projectId })
          .andWhere('t.kanban_status = :draft', { draft: TaskKanbanStatus.DRAFT })
          .andWhere('t.deleted_at IS NULL')
          .getRawOne<{ max_order: number }>();
        let nextOrder = Number(maxOrder?.max_order ?? 0);
        for (const row of creates) {
          const { codeSeq, code } = await tx.taskCodes.next(projectId, project.code);
          nextOrder += 1;
          const created = await tx.tasks.save(
            tx.tasks.create({
              projectId,
              code,
              codeSeq,
              title: row.title!,
              description: row.description ?? null,
              price: Number(row.price ?? 0),
              kanbanStatus: TaskKanbanStatus.DRAFT,
              creationMode: TaskCreationMode.AI_ASSISTED,
              displayOrder: nextOrder,
            }),
          );
          await tx.taskHistory.save(
            tx.taskHistory.create({
              taskId: created.id,
              changeType: TaskHistoryChangeType.CREATED,
              changedBy: this.requestContext.userId!,
            }),
          );
          await this.aiContext.patchTaskInIndex(tx, projectId, created);
          results.push(
            plainToInstance(
              AiSyncTaskResultDto,
              {
                client_temp_id: row.clientTempId ?? null,
                status: 'created' satisfies AiSyncTaskOutcome,
                task_id: created.id,
              },
              { excludeExtraneousValues: true },
            ),
          );
        }
      }

      const finalStatus = await this.projectStatus.recomputeAutoStatus(tx, projectId);
      return { results, status: finalStatus };
    });

    this.logger.log(
      `aiSyncTasks — complete | projectId: ${projectId}, ` +
        `applied: ${result.results.length}, status: ${result.status}`,
    );

    return plainToInstance(
      AiSyncTasksResponseDto,
      {
        results: result.results,
        project_status: result.status,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async addToBoardValidation(
    projectId: string,
    dto: TaskIdsDto,
  ): Promise<AddToBoardValidationResponseDto> {
    this.logger.log(
      `addToBoardValidation — start | projectId: ${projectId}, count: ${dto.taskIds.length}`,
    );
    const { project, businessProfile } = await this.access.resolveOwnedProject(projectId);
    this.assertProjectAcceptsAddToBoard(project);

    const tasks = await this.uow.tasks.find({
      where: { id: In(dto.taskIds), projectId },
    });
    this.assertAllTasksAreDraft(dto.taskIds, tasks);

    const pricing = this.computePricing(tasks, businessProfile);
    const accountBalance = Money.from(businessProfile.accountBalance);

    const isValid =
      pricing.paymentType === PaymentType.CREDIT || accountBalance.gte(pricing.totalAmount);

    this.logger.log(
      `addToBoardValidation — complete | projectId: ${projectId}, total: ${pricing.totalAmount.toFixedString()}, balance: ${accountBalance.toFixedString()}, valid: ${isValid}`,
    );

    return plainToInstance(
      AddToBoardValidationResponseDto,
      {
        is_valid: isValid,
        reason_code: isValid ? null : ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
        moved_task_ids: dto.taskIds,
        project_amount: pricing.projectAmount.toFixedString(),
        commission_rate: pricing.commissionRate,
        commission_amount: pricing.commissionAmount.toFixedString(),
        total_amount: pricing.totalAmount.toFixedString(),
        payment_type: pricing.paymentType,
        account_balance: accountBalance.toFixedString(),
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async payTasks(projectId: string, dto: TaskIdsDto): Promise<PayTasksResponseDto> {
    this.logger.log(`payTasks — start | projectId: ${projectId}, count: ${dto.taskIds.length}`);
    const { project } = await this.access.resolveOwnedProject(projectId);
    this.assertProjectAcceptsAddToBoard(project);

    const result = await this.uow.withTransaction(async (tx) => {
      // Lock the business profile so two concurrent pay-tasks calls cannot
      // both pass the balance check and double-debit. Ownership was asserted
      // outside the lock; lock by id is safe because findOneByUserAndId
      // already verified the user owns this profile.
      const userId = this.requestContext.userId!;
      const businessId = this.requestContext.businessId!;
      const profile = await this.profilesLedger.lockBusinessProfile(businessId, tx);
      if (!profile || profile.userId !== userId) {
        throw new TranslatableException({
          messageKey: 'error.business_profile.not_found',
          errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
          status: HttpStatus.FORBIDDEN,
        });
      }

      // Reload tasks under the same TX so the DRAFT precondition can't slip
      // between the validation read and this write.
      const tasks = await tx.tasks
        .createQueryBuilder('t')
        .where('t.id IN (:...ids)', { ids: dto.taskIds })
        .andWhere('t.project_id = :projectId', { projectId })
        .setLock('pessimistic_write')
        .getMany();
      this.assertAllTasksAreDraft(dto.taskIds, tasks);

      const pricing = this.computePricing(tasks, profile);

      if (pricing.paymentType === PaymentType.PRE_PAID) {
        const balance = Money.from(profile.accountBalance);
        if (balance.lt(pricing.totalAmount)) {
          throw new TranslatableException({
            messageKey: 'error.project.insufficient_balance',
            errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }
        profile.accountBalance = balance.sub(pricing.totalAmount).toFixedString();
        await this.profilesLedger.saveBusinessProfile(profile, tx);
      }

      const transactionStatus =
        pricing.paymentType === PaymentType.PRE_PAID
          ? TransactionStatus.COMPLETED
          : TransactionStatus.PENDING;

      const transactionNumber = await tx.transactionNumbers.next(
        'PLS',
        BusinessTransactionType.TASK_ADDED,
      );
      const txn = tx.businessTransactions.create({
        transactionNumber,
        businessId: profile.id,
        type: BusinessTransactionType.TASK_ADDED,
        amount: pricing.projectAmount.toFixedString(),
        commissionRate: pricing.commissionRate,
        commissionAmount: pricing.commissionAmount.toFixedString(),
        totalAmount: pricing.totalAmount.toFixedString(),
        status: transactionStatus,
        projectId,
        note: `Pay tasks (${tasks.length}): ${tasks.map((t) => t.title).join(', ')}`.slice(0, 1000),
      });
      const savedTxn = await tx.businessTransactions.save(txn);

      // Promote drafts to TO_DO and append to current TO_DO display order.
      const maxRow = await tx.tasks
        .createQueryBuilder('t')
        .select('COALESCE(MAX(t.display_order), 0)', 'max_order')
        .where('t.project_id = :projectId', { projectId })
        .andWhere('t.kanban_status = :toDo', { toDo: TaskKanbanStatus.TO_DO })
        .andWhere('t.deleted_at IS NULL')
        .getRawOne<{ max_order: number }>();
      let nextOrder = Number(maxRow?.max_order ?? 0) + 1;
      for (const task of tasks) {
        task.kanbanStatus = TaskKanbanStatus.TO_DO;
        task.displayOrder = nextOrder++;
      }
      await tx.tasks.save(tasks);
      await tx.taskHistory.save(
        tasks.map((task) =>
          tx.taskHistory.create({
            taskId: task.id,
            changeType: TaskHistoryChangeType.PAID,
            changedBy: userId,
          }),
        ),
      );

      return {
        txnId: savedTxn.id,
        pricing,
        publishedTasks: tasks,
        businessName: profile.companyName ?? '',
      };
    });

    this.logger.log(
      `payTasks — complete | projectId: ${projectId}, txn: ${result.txnId}, paymentType: ${result.pricing.paymentType}`,
    );

    const businessUserId = this.requestContext.userId!;
    for (const task of result.publishedTasks) {
      this.eventEmitter.emit(NOTIFICATION_EVENTS.TASK_PUBLISHED, {
        task_id: task.id,
        task_code: task.code,
        task_title: task.title,
        project_id: projectId,
        project_code: project.code,
        business_user_id: businessUserId,
        business_name: result.businessName,
      });
    }

    return plainToInstance(
      PayTasksResponseDto,
      {
        moved_task_ids: dto.taskIds,
        project_amount: result.pricing.projectAmount.toFixedString(),
        commission_rate: result.pricing.commissionRate,
        commission_amount: result.pricing.commissionAmount.toFixedString(),
        total_amount: result.pricing.totalAmount.toFixedString(),
        payment_type: result.pricing.paymentType,
        transaction_id: result.txnId,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private validateAiSyncRowFields(row: AiSyncTaskRowDto): boolean {
    switch (row.action) {
      case 'create':
        // create rows must NOT carry task_id; title is required (price is
        // optional — defaults to 0, which the price-gate endpoint rejects
        // before publish so a 0-priced placeholder is fine for now).
        if (row.taskId !== undefined) return false;
        if (!row.title || row.title.trim().length < 3) return false;
        return true;
      case 'update':
      case 'delete':
        return typeof row.taskId === 'string' && row.taskId.length > 0;
      default:
        return false;
    }
  }

  private assertProjectAcceptsAddToBoard(project: Project): void {
    if (!ALLOWED_ADD_TO_BOARD_STATUSES.has(project.status)) {
      this.logger.warn(
        `assertProjectAcceptsAddToBoard — wrong status | projectId: ${project.id}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.invalid_status_transition',
        errorCode: ERROR_CODES.PROJECT_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
  }

  private assertAllTasksAreDraft(supplied: string[], loaded: Task[]): void {
    if (loaded.length !== supplied.length) {
      this.logger.warn(
        `assertAllTasksAreDraft — count mismatch | supplied: ${supplied.length}, found: ${loaded.length}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.invalid_status_transition',
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
    const nonDraft = loaded.filter((t) => t.kanbanStatus !== TaskKanbanStatus.DRAFT);
    if (nonDraft.length > 0) {
      this.logger.warn(
        `assertAllTasksAreDraft — non-draft tasks | ids: ${nonDraft.map((t) => t.id).join(',')}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.invalid_status_transition',
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
  }

  private computePricing(
    tasks: Task[],
    businessProfile: IBusinessProfileSnapshot | IBusinessProfileLock,
  ): PricingBreakdown {
    const projectAmount = Money.sum(tasks.map((t) => t.price));
    const paymentType = businessProfile.allowPaymentCredit
      ? PaymentType.CREDIT
      : PaymentType.PRE_PAID;
    const commissionRate =
      paymentType === PaymentType.CREDIT
        ? '0'
        : (businessProfile.commissionRate?.toString() ?? DEFAULT_COMMISSION_RATE);
    const commissionAmount = projectAmount.mulRate(commissionRate);
    const totalAmount = projectAmount.add(commissionAmount);
    return { projectAmount, commissionRate, commissionAmount, totalAmount, paymentType };
  }

  /** @inheritdoc */
  public async getTaskDetail(projectId: string, taskId: string): Promise<DraftTaskResponseDto> {
    this.logger.log(`getTaskDetail — start | projectId: ${projectId}, taskId: ${taskId}`);
    await this.access.resolveOwnedProject(projectId);

    const task = await this.uow.tasks.findOne({
      where: { id: taskId, projectId, kanbanStatus: TaskKanbanStatus.DRAFT },
    });
    if (!task) {
      this.logger.warn(`getTaskDetail — not found | taskId: ${taskId}`);
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const attachments = await this.uow.taskAttachments.find({
      where: { taskId },
      order: { uploadedAt: 'ASC' },
    });

    this.logger.log(
      `getTaskDetail — complete | taskId: ${taskId}, attachments: ${attachments.length}`,
    );
    return this.toDraftTaskResponse(task, attachments);
  }

  private toDraftTaskResponse(
    task: Task,
    attachments: TaskAttachment[] = [],
  ): DraftTaskResponseDto {
    return plainToInstance(
      DraftTaskResponseDto,
      {
        id: task.id,
        code: task.code,
        title: task.title,
        description: task.description,
        price: Number(task.price).toFixed(2),
        platform_fee_amount: Number(task.platformFeeAmount ?? 0).toFixed(2),
        consultant_payout: Number(task.consultantPayout ?? 0).toFixed(2),
        creation_mode: task.creationMode,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        attachments_count: attachments.length,
        attachments: attachments.map((a) => ({
          id: a.id,
          file_id: a.fileId,
          file_name: a.fileName,
          mime_type: a.mimeType,
          file_size_bytes: a.fileSizeBytes === null ? null : Number(a.fileSizeBytes),
          uploaded_at: a.uploadedAt,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }
}
