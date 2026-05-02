import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Money } from '@common/utils/money';
import { BusinessProfile, Project, Task } from '@database/entities';
import {
  BusinessTransactionType,
  PaymentType,
  ProjectStatus,
  TaskCreationMode,
  TaskKanbanStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ILike, In } from 'typeorm';

import {
  CreateDraftTaskDto,
  ListDraftTasksDto,
  TaskIdsDto,
  UpdateDraftTaskDto,
} from '../dto/requests';
import {
  AddToBoardValidationResponseDto,
  DraftTaskResponseDto,
  PayTasksResponseDto,
} from '../dto/responses';
import { IBacklogsService } from '../interfaces/backlogs.service.interface';
import { BusinessAccessService } from './business-access.service';

const DEFAULT_COMMISSION_RATE = '0.25';

const ALLOWED_ADD_TO_BOARD_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
]);

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
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
  ) {
    this.logger = new AppLogger(BacklogsService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async createDraftTask(
    projectId: string,
    dto: CreateDraftTaskDto,
  ): Promise<DraftTaskResponseDto> {
    this.logger.log(
      `[${this.rid}] createDraftTask — start | projectId: ${projectId}, title: ${dto.title}`,
    );
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
        difficultyLevel: dto.difficultyLevel,
        kanbanStatus: TaskKanbanStatus.DRAFT,
        creationMode: TaskCreationMode.MANUAL,
        displayOrder: Number(maxOrder?.max_order ?? 0) + 1,
      });
      const saved = await tx.tasks.save(task);
      return saved.id;
    });

    // Re-read outside the transaction so the STORED generated columns
    // (`platform_fee_amount`, `consultant_payout`) are populated.
    const reloaded = await this.uow.tasks.findOne({ where: { id: savedId } });
    if (!reloaded) {
      // Should be unreachable — we just inserted in a committed transaction.
      throw new Error(`createDraftTask: failed to reload task ${savedId}`);
    }

    this.logger.log(
      `[${this.rid}] createDraftTask — complete | taskId: ${reloaded.id}, code: ${reloaded.code}`,
    );
    return this.toDraftTaskResponse(reloaded);
  }

  /** @inheritdoc */
  public async updateDraftTask(
    projectId: string,
    taskId: string,
    dto: UpdateDraftTaskDto,
  ): Promise<DraftTaskResponseDto> {
    this.logger.log(
      `[${this.rid}] updateDraftTask — start | projectId: ${projectId}, taskId: ${taskId}`,
    );
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
    if (dto.difficultyLevel !== undefined) task.difficultyLevel = dto.difficultyLevel;

    const saved = await this.uow.tasks.save(task);

    this.logger.log(`[${this.rid}] updateDraftTask — complete | taskId: ${saved.id}`);
    return this.toDraftTaskResponse(saved);
  }

  /** @inheritdoc */
  public async listDraftTasks(
    projectId: string,
    dto: ListDraftTasksDto,
  ): Promise<PageDto<DraftTaskResponseDto>> {
    this.logger.log(
      `[${this.rid}] listDraftTasks — start | projectId: ${projectId}, page: ${dto.page}, keywords: ${dto.keywords ?? '<none>'}`,
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

    const data = tasks.map((t) => this.toDraftTaskResponse(t));
    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `[${this.rid}] listDraftTasks — complete | projectId: ${projectId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async bulkDelete(projectId: string, dto: TaskIdsDto): Promise<void> {
    this.logger.log(
      `[${this.rid}] bulkDelete — start | projectId: ${projectId}, count: ${dto.taskIds.length}`,
    );
    await this.access.resolveOwnedProject(projectId);

    await this.uow.withTransaction(async (tx) => {
      const tasks = await tx.tasks.find({
        where: { id: In(dto.taskIds), projectId },
      });
      this.assertAllTasksAreDraft(dto.taskIds, tasks);
      await tx.tasks.delete({ id: In(dto.taskIds) });
    });

    this.logger.log(
      `[${this.rid}] bulkDelete — complete | projectId: ${projectId}, deleted: ${dto.taskIds.length}`,
    );
  }

  /** @inheritdoc */
  public async addToBoardValidation(
    projectId: string,
    dto: TaskIdsDto,
  ): Promise<AddToBoardValidationResponseDto> {
    this.logger.log(
      `[${this.rid}] addToBoardValidation — start | projectId: ${projectId}, count: ${dto.taskIds.length}`,
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
      `[${this.rid}] addToBoardValidation — complete | projectId: ${projectId}, total: ${pricing.totalAmount.toFixedString()}, balance: ${accountBalance.toFixedString()}, valid: ${isValid}`,
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
    this.logger.log(
      `[${this.rid}] payTasks — start | projectId: ${projectId}, count: ${dto.taskIds.length}`,
    );
    const { project } = await this.access.resolveOwnedProject(projectId);
    this.assertProjectAcceptsAddToBoard(project);

    const result = await this.uow.withTransaction(async (tx) => {
      // Lock the business profile so two concurrent pay-tasks calls cannot
      // both pass the balance check and double-debit. Ownership was asserted
      // outside the lock; lock by id is safe because findOneByUserAndId
      // already verified the user owns this profile.
      const userId = this.requestContext.userId!;
      const businessId = this.requestContext.businessId!;
      const profile = await tx.businessProfiles.findByIdForUpdate(businessId);
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
        await tx.businessProfiles.save(profile);
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

      return { txnId: savedTxn.id, pricing };
    });

    this.logger.log(
      `[${this.rid}] payTasks — complete | projectId: ${projectId}, txn: ${result.txnId}, paymentType: ${result.pricing.paymentType}`,
    );

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

  private assertProjectAcceptsAddToBoard(project: Project): void {
    if (!ALLOWED_ADD_TO_BOARD_STATUSES.has(project.status)) {
      this.logger.warn(
        `[${this.rid}] assertProjectAcceptsAddToBoard — wrong status | projectId: ${project.id}, status: ${project.status}`,
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
        `[${this.rid}] assertAllTasksAreDraft — count mismatch | supplied: ${supplied.length}, found: ${loaded.length}`,
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
        `[${this.rid}] assertAllTasksAreDraft — non-draft tasks | ids: ${nonDraft.map((t) => t.id).join(',')}`,
      );
      throw new TranslatableException({
        messageKey: 'error.task.invalid_status_transition',
        errorCode: ERROR_CODES.TASK_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
  }

  private computePricing(tasks: Task[], businessProfile: BusinessProfile): PricingBreakdown {
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

  private toDraftTaskResponse(task: Task): DraftTaskResponseDto {
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
        difficulty_level: task.difficultyLevel,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
