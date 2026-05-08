import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Money } from '@common/utils/money';
import { BusinessProfile, Project } from '@database/entities';
import {
  BusinessTransactionType,
  PaymentMethod,
  PaymentType,
  ProjectPaymentType,
  ProjectStatus,
  TaskKanbanStatus,
  TransactionStatus,
} from '@database/enums';
import { NOTIFICATION_TYPES } from '@modules/notifications/enums/notification-type.enum';
import { NotificationDispatcherService } from '@modules/notifications/services/notification-dispatcher.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { PublishValidationResponseDto } from '../../dto/responses';
import { IProjectPublishService } from '../../interfaces/project-publish.service.interface';
import { BusinessAccessService } from '../business-access.service';

/** Default platform commission applied to pre-paid publications when the
 * business profile has no override (`commission_rate` IS NULL). */
const DEFAULT_COMMISSION_RATE = '0.25';

interface PublishEligibility {
  canPublish: boolean;
  reasonCode: string | null;
  accountBalance: Money;
  projectAmount: Money;
  commissionRate: string;
  commissionAmount: Money;
  totalAmount: Money;
  paymentType: PaymentType;
}

@Injectable()
export class ProjectPublishService implements IProjectPublishService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {
    this.logger = new AppLogger(ProjectPublishService.name, requestContext);
  }

  /** @inheritdoc */
  public async validatePublish(projectId: string): Promise<PublishValidationResponseDto> {
    const { project, businessProfile } = await this.access.resolveOwnedProject(projectId);
    this.logger.log(
      `validatePublish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    const result = await this.evaluatePublishEligibility(project, businessProfile);

    this.logger.log(
      `validatePublish — complete | projectId: ${projectId}, canPublish: ${result.canPublish}, paymentType: ${result.paymentType}`,
    );

    return plainToInstance(
      PublishValidationResponseDto,
      {
        can_publish: result.canPublish,
        reason_code: result.reasonCode,
        account_balance: result.accountBalance.toNumber(),
        project_title: project.title,
        project_amount: result.projectAmount.toNumber(),
        commission_rate: Number(result.commissionRate),
        commission_amount: result.commissionAmount.toNumber(),
        total_amount: result.totalAmount.toNumber(),
        payment_type: result.paymentType,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async confirmPublish(projectId: string): Promise<void> {
    const { project, businessProfile } = await this.access.resolveOwnedProject(projectId);
    this.logger.log(
      `confirmPublish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    // First-pass eligibility outside the transaction — quick reject for
    // unaffordable / mis-statused projects without taking row locks.
    const preview = await this.evaluatePublishEligibility(project, businessProfile);
    if (!preview.canPublish) {
      if (preview.reasonCode === 'INSUFFICIENT_BALANCE') {
        this.logger.warn(
          `confirmPublish — insufficient balance | projectId: ${projectId}, balance: ${preview.accountBalance.toFixedString()}, required: ${preview.totalAmount.toFixedString()}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.insufficient_balance',
          errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
      if (preview.reasonCode === 'INVALID_TASK_PRICE') {
        this.logger.warn(`confirmPublish — invalid task price | projectId: ${projectId}`);
        throw new TranslatableException({
          messageKey: 'error.project.invalid_task_price',
          errorCode: ERROR_CODES.PROJECT_INVALID_TASK_PRICE,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
      this.logger.warn(
        `confirmPublish — cannot publish | projectId: ${projectId}, reasonCode: ${preview.reasonCode}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.cannot_publish',
        errorCode: ERROR_CODES.PROJECT_CANNOT_PUBLISH,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Lock + re-check + deduct atomically. Without the row lock two concurrent
    // publish calls could both pass the balance check and over-draw the
    // account; SELECT ... FOR UPDATE serialises the second caller behind the
    // first.
    const { eligibility, transactionNumber, promotedTaskCount } = await this.uow.withTransaction(
      async (txUow) => {
        const lockedProfile = await txUow.businessProfiles.findByIdForUpdate(businessProfile.id);
        if (!lockedProfile) {
          this.logger.warn(
            `confirmPublish — profile vanished mid-transaction | businessId: ${businessProfile.id}`,
          );
          throw new TranslatableException({
            messageKey: 'error.business_profile.not_found',
            errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
            status: HttpStatus.FORBIDDEN,
          });
        }

        const lockedEligibility = await this.evaluatePublishEligibility(project, lockedProfile);
        if (!lockedEligibility.canPublish) {
          if (lockedEligibility.reasonCode === 'INSUFFICIENT_BALANCE') {
            this.logger.warn(
              `confirmPublish — insufficient balance after lock | projectId: ${projectId}, balance: ${lockedEligibility.accountBalance.toFixedString()}`,
            );
            throw new TranslatableException({
              messageKey: 'error.project.insufficient_balance',
              errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
              status: HttpStatus.UNPROCESSABLE_ENTITY,
            });
          }
          if (lockedEligibility.reasonCode === 'INVALID_TASK_PRICE') {
            throw new TranslatableException({
              messageKey: 'error.project.invalid_task_price',
              errorCode: ERROR_CODES.PROJECT_INVALID_TASK_PRICE,
              status: HttpStatus.UNPROCESSABLE_ENTITY,
            });
          }
          throw new TranslatableException({
            messageKey: 'error.project.cannot_publish',
            errorCode: ERROR_CODES.PROJECT_CANNOT_PUBLISH,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }

        let txnNumber: string | null = null;
        if (lockedEligibility.paymentType === PaymentType.PRE_PAID) {
          const newBalance = lockedEligibility.accountBalance.sub(lockedEligibility.totalAmount);
          if (newBalance.isNegative()) {
            // Defensive — the lock should have prevented this. Map to the same
            // user-facing error rather than letting the column constraint raise
            // a generic DB error.
            throw new TranslatableException({
              messageKey: 'error.project.insufficient_balance',
              errorCode: ERROR_CODES.PROJECT_INSUFFICIENT_BALANCE,
              status: HttpStatus.UNPROCESSABLE_ENTITY,
            });
          }
          lockedProfile.accountBalance = newBalance.toFixedString();
          await txUow.businessProfiles.save(lockedProfile);

          txnNumber = await txUow.transactionNumbers.next(
            'PLS',
            BusinessTransactionType.PROJECT_PUBLISHED,
          );
          const txn = txUow.businessTransactions.create({
            transactionNumber: txnNumber,
            businessId: lockedProfile.id,
            type: BusinessTransactionType.PROJECT_PUBLISHED,
            amount: lockedEligibility.projectAmount.toFixedString(),
            commissionRate: Number(lockedEligibility.commissionRate).toFixed(4),
            commissionAmount: lockedEligibility.commissionAmount.toFixedString(),
            totalAmount: lockedEligibility.totalAmount.toFixedString(),
            status: TransactionStatus.COMPLETED,
            projectId,
            note: `Pre-paid project publication: ${project.title} (tasks: ${lockedEligibility.projectAmount.toFixedString()} + commission ${(Number(lockedEligibility.commissionRate) * 100).toFixed(0)}%: ${lockedEligibility.commissionAmount.toFixedString()})`,
          });
          await txUow.businessTransactions.save(txn);
        }

        // Lock the payment_type at publish time based on the business's billing
        // mode. CREDIT businesses are billed monthly (PER_MONTH); PRE_PAID
        // businesses are charged per-task at this very publish call (PER_TASK).
        // The column is locked here so subsequent toggles of
        // business_profile.allow_payment_credit do not retroactively rewrite
        // the consultant overview shape for in-flight projects.
        project.paymentType =
          lockedEligibility.paymentType === PaymentType.CREDIT
            ? ProjectPaymentType.PER_MONTH
            : ProjectPaymentType.PER_TASK;
        project.status = ProjectStatus.PUBLISHED;
        project.publishedAt = DateUtil.nowDate();
        await txUow.projects.save(project);

        // Promote every existing draft task to TO_DO so the board surfaces them
        // immediately after publish. The publish fee already covers these tasks
        // (their prices are summed into `projectAmount` above), so no separate
        // `task_added` transaction is needed here — that path is reserved for
        // drafts added *after* publish via `BacklogsService.payTasks`. Ordering
        // by `display_order ASC` preserves the order the business set in the
        // backlog.
        const draftTasks = await txUow.tasks.find({
          where: { projectId, kanbanStatus: TaskKanbanStatus.DRAFT },
          order: { displayOrder: 'ASC' },
        });
        if (draftTasks.length > 0) {
          const maxRow = await txUow.tasks
            .createQueryBuilder('t')
            .select('COALESCE(MAX(t.display_order), 0)', 'max_order')
            .where('t.project_id = :projectId', { projectId })
            .andWhere('t.kanban_status = :toDo', { toDo: TaskKanbanStatus.TO_DO })
            .andWhere('t.deleted_at IS NULL')
            .getRawOne<{ max_order: number }>();
          let nextOrder = Number(maxRow?.max_order ?? 0) + 1;
          for (const task of draftTasks) {
            task.kanbanStatus = TaskKanbanStatus.TO_DO;
            task.displayOrder = nextOrder++;
          }
          await txUow.tasks.save(draftTasks);
        }

        return {
          eligibility: lockedEligibility,
          transactionNumber: txnNumber,
          promotedTaskCount: draftTasks.length,
        };
      },
    );

    this.logger.log(
      `confirmPublish — complete | projectId: ${projectId}, paymentType: ${eligibility.paymentType}, promotedTasks: ${promotedTaskCount}`,
    );

    await this.sendPublishEmail(project, businessProfile, eligibility, transactionNumber);

    // Fire-and-forget — never blocks the request, never throws back to the caller.
    void this.notificationDispatcher
      .dispatch({
        userId: businessProfile.userId,
        type: NOTIFICATION_TYPES.PROJECT_PUBLISHED,
        metadata: {
          project_id: project.id,
          project_code: project.code,
          project_title: project.title,
        },
        actorId: this.requestContext.userId ?? null,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`confirmPublish — notification dispatch failed | error: ${msg}`);
      });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async evaluatePublishEligibility(
    project: Project,
    businessProfile: BusinessProfile,
  ): Promise<PublishEligibility> {
    const accountBalance = Money.from(businessProfile.accountBalance);
    const paymentType: PaymentType = businessProfile.allowPaymentCredit
      ? PaymentType.CREDIT
      : PaymentType.PRE_PAID;

    const tasks = await this.uow.tasks.find({ where: { projectId: project.id } });
    const projectAmount = Money.sum(tasks.map((t) => t.price));

    // Commission only applies to pre-paid businesses.
    const commissionRate =
      paymentType === PaymentType.PRE_PAID
        ? (businessProfile.commissionRate ?? DEFAULT_COMMISSION_RATE)
        : '0';
    const commissionAmount = projectAmount.mulRate(commissionRate);
    const totalAmount = projectAmount.add(commissionAmount);

    const baseResult = {
      accountBalance,
      projectAmount,
      commissionRate,
      commissionAmount,
      totalAmount,
      paymentType,
    };

    if (project.status !== ProjectStatus.CONFIGURED) {
      return { ...baseResult, canPublish: false, reasonCode: 'NOT_CONFIGURED' };
    }

    if (tasks.length === 0 || tasks.some((t) => !Money.from(t.price).isPositive())) {
      return { ...baseResult, canPublish: false, reasonCode: 'INVALID_TASK_PRICE' };
    }

    if (paymentType === PaymentType.CREDIT) {
      // Credit-based businesses are billed monthly; the publish call itself
      // does not move money. Zero out commission for the response payload.
      return {
        ...baseResult,
        commissionRate: '0',
        commissionAmount: Money.zero(),
        totalAmount: projectAmount,
        canPublish: true,
        reasonCode: null,
      };
    }

    if (accountBalance.gte(totalAmount)) {
      return { ...baseResult, canPublish: true, reasonCode: null };
    }

    return { ...baseResult, canPublish: false, reasonCode: 'INSUFFICIENT_BALANCE' };
  }

  // Sends the post-publish notification. Email failures must not roll back
  // the publish — the project is already PUBLISHED and the wallet has been
  // settled when this method runs.
  private async sendPublishEmail(
    project: Project,
    businessProfile: BusinessProfile,
    eligibility: PublishEligibility,
    transactionNumber: string | null,
  ): Promise<void> {
    const user = await this.uow.users.findOne({ where: { id: businessProfile.userId } });
    if (!user?.email) return;

    try {
      const projectUrl = `${this.env.ployosUrl}/c/${businessProfile.id}/projects/${project.id}`;

      if (eligibility.paymentType === PaymentType.PRE_PAID) {
        if (!transactionNumber) {
          // Pre-paid path always writes a transaction; missing number means the
          // upstream commit silently dropped it. Log + abort the email rather
          // than send a receipt with a fabricated id.
          this.logger.error(
            `sendPublishEmail — missing transactionNumber on PRE_PAID | projectId: ${project.id}`,
          );
          return;
        }
        const paidDate = DateUtil.format(
          DateUtil.now(this.requestContext.timezone ?? undefined),
          'MMMM D, YYYY',
          this.requestContext.timezone ?? undefined,
        );

        await this.emailService.sendProjectPublishedReceiptEmail(user.email, {
          businessName: businessProfile.companyName || 'Business Owner',
          transactionNumber,
          paidDate,
          projectTitle: project.title,
          paymentMethod: PaymentMethod.ACCOUNT_BALANCE,
          amount: eligibility.projectAmount.toFixedString(),
          commissionRate: (Number(eligibility.commissionRate) * 100).toFixed(2),
          commissionAmount: eligibility.commissionAmount.toFixedString(),
          totalAmount: eligibility.totalAmount.toFixedString(),
          projectDashboardUrl: projectUrl,
        });
        this.logger.log(
          `sendPublishEmail — receipt sent | projectId: ${project.id}, email: ${user.email}`,
        );
      } else {
        await this.emailService.sendProjectPublishedSuccessEmail(user.email, {
          businessName: businessProfile.companyName || 'Business Owner',
          projectTitle: project.title,
          projectHubUrl: projectUrl,
        });
        this.logger.log(
          `sendPublishEmail — success sent | projectId: ${project.id}, email: ${user.email}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `sendPublishEmail — failed | projectId: ${project.id}, paymentType: ${eligibility.paymentType}, error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
