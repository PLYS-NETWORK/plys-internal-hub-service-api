import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_EVENTS } from '@plys/libraries/common-nest/events';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { EmailService } from '@plys/libraries/common-nest/modules/email/email.service';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientService } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { Money } from '@plys/libraries/common-nest/utils/money';
import { Project } from '@plys/libraries/database/entities';
import {
  BusinessTransactionType,
  PaymentMethod,
  ProjectStatus,
  TaskKanbanStatus,
  TransactionStatus,
} from '@plys/libraries/database/enums';
import {
  IBusinessProfileSnapshot,
  IProfilesLedger,
  PROFILES_LEDGER,
} from '@plys/libraries/profiles-port';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { Not } from 'typeorm';

import { ERROR_CODES } from '../../../../errors/error-codes';
import { IProjectRepublishService } from '../../interfaces/project-republish.service.interface';
import { BusinessAccessService } from '../business-access.service';

@Injectable()
export class ProjectRepublishService implements IProjectRepublishService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    @Inject(PROFILES_LEDGER) private readonly profilesLedger: IProfilesLedger,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly notificationsClient: NotificationsClientService,
  ) {
    this.logger = new AppLogger(ProjectRepublishService.name, requestContext);
  }

  /** @inheritdoc */
  public async republish(projectId: string): Promise<void> {
    const { project, businessProfile } = await this.access.resolveOwnedProject(projectId);
    this.logger.log(
      `republish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    if (project.status !== ProjectStatus.PUBLISHED) {
      this.logger.warn(
        `republish — wrong status | projectId: ${projectId}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.invalid_status_transition',
        errorCode: ERROR_CODES.PROJECT_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Wallet credit + refund txns + task reset + status flip must be atomic;
    // the row lock on the profile prevents a concurrent task-payment from
    // racing with the refund and corrupting the running balance. The lock is
    // taken unconditionally because both the publish-fee refund (PRE_PAID)
    // and any per-task refunds (mixed: PRE_PAID writes balance, CREDIT just
    // reverses the PENDING txn) need a consistent profile snapshot.
    const result = await this.uow.withTransaction(async (txUow) => {
      const lockedProfile = await this.profilesLedger.lockBusinessProfile(
        businessProfile.id,
        txUow,
      );
      if (!lockedProfile) {
        this.logger.warn(
          `republish — profile vanished mid-transaction | businessId: ${businessProfile.id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.business_profile.not_found',
          errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
          status: HttpStatus.FORBIDDEN,
        });
      }

      // 1. Refund the original publish fee (PRE_PAID flow only).
      let publishFeeRefund: { amount: string; transactionNumber: string } | null = null;
      if (!businessProfile.allowPaymentCredit) {
        const originalTxn = await txUow.businessTransactions.findOne({
          where: {
            projectId: project.id,
            type: BusinessTransactionType.PROJECT_PUBLISHED,
            status: TransactionStatus.COMPLETED,
          },
        });
        if (!originalTxn) {
          this.logger.warn(
            `republish — original publish transaction not found | projectId: ${projectId}`,
          );
          throw new TranslatableException({
            messageKey: 'error.project.recall_transaction_not_found',
            errorCode: ERROR_CODES.PROJECT_RECALL_TRANSACTION_NOT_FOUND,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }

        const newBalance = Money.from(lockedProfile.accountBalance).add(
          Money.from(originalTxn.amount),
        );
        lockedProfile.accountBalance = newBalance.toFixedString();

        const refundTxnNumber = await txUow.transactionNumbers.next(
          'PLS',
          BusinessTransactionType.REFUND,
        );
        const refundTxn = txUow.businessTransactions.create({
          transactionNumber: refundTxnNumber,
          businessId: lockedProfile.id,
          type: BusinessTransactionType.REFUND,
          amount: originalTxn.amount,
          totalAmount: originalTxn.amount,
          status: TransactionStatus.COMPLETED,
          projectId: project.id,
          note: `Re-publish refund: ${project.title}`,
        });
        await txUow.businessTransactions.save(refundTxn);

        publishFeeRefund = {
          amount: originalTxn.amount,
          transactionNumber: refundTxnNumber,
        };
      }

      // 2. Refund / reverse every prior `payTasks` transaction. Status is the
      // source of truth — businesses can flip allowPaymentCredit between calls,
      // so we drive the refund decision per-row rather than off the current
      // profile flag.
      const taskTxns = await txUow.businessTransactions.find({
        where: { projectId: project.id, type: BusinessTransactionType.TASK_ADDED },
      });
      let taskRefundTotal = Money.from('0');
      let firstTaskRefundTxnNumber: string | null = null;
      for (const txn of taskTxns) {
        if (txn.status === TransactionStatus.COMPLETED) {
          // PRE_PAID flow at the time of payment — money already moved; credit
          // it back and emit a REFUND row.
          const credited = Money.from(lockedProfile.accountBalance).add(
            Money.from(txn.totalAmount),
          );
          lockedProfile.accountBalance = credited.toFixedString();
          taskRefundTotal = taskRefundTotal.add(Money.from(txn.totalAmount));

          const refundTxnNumber = await txUow.transactionNumbers.next(
            'PLS',
            BusinessTransactionType.REFUND,
          );
          const refundTxn = txUow.businessTransactions.create({
            transactionNumber: refundTxnNumber,
            businessId: lockedProfile.id,
            type: BusinessTransactionType.REFUND,
            amount: txn.amount,
            totalAmount: txn.totalAmount,
            status: TransactionStatus.COMPLETED,
            projectId: project.id,
            note: `Re-publish task refund: ${txn.transactionNumber}`,
          });
          await txUow.businessTransactions.save(refundTxn);
          firstTaskRefundTxnNumber ??= refundTxnNumber;
        } else if (txn.status === TransactionStatus.PENDING) {
          // CREDIT flow — no money was moved; mark the pending charge reversed
          // so it does not get billed.
          txn.status = TransactionStatus.REVERSED;
          await txUow.businessTransactions.save(txn);
        }
      }

      await this.profilesLedger.saveBusinessProfile(lockedProfile, txUow);

      // 3. Reset every non-DRAFT task back to DRAFT and re-issue display_order
      // contiguously after the existing drafts. By construction these tasks
      // have no assignee — republish is gated on PUBLISHED, and assignment
      // auto-promotes to IN_PROGRESS which blocks republish — but assert so a
      // future regression surfaces loudly instead of silently corrupting state.
      const tasksToReset = await txUow.tasks.find({
        where: { projectId: project.id, kanbanStatus: Not(TaskKanbanStatus.DRAFT) },
      });
      if (tasksToReset.length > 0) {
        const stillAssigned = tasksToReset.filter((t) => t.assignedTo !== null);
        if (stillAssigned.length > 0) {
          this.logger.error(
            `republish — assigned tasks present at republish time | projectId: ${projectId}, taskIds: ${stillAssigned.map((t) => t.id).join(',')}`,
          );
          throw new TranslatableException({
            messageKey: 'error.project.invalid_status_transition',
            errorCode: ERROR_CODES.PROJECT_INVALID_STATUS_TRANSITION,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
          });
        }

        const maxRow = await txUow.tasks
          .createQueryBuilder('t')
          .select('COALESCE(MAX(t.display_order), 0)', 'max_order')
          .where('t.project_id = :projectId', { projectId: project.id })
          .andWhere('t.kanban_status = :draft', { draft: TaskKanbanStatus.DRAFT })
          .andWhere('t.deleted_at IS NULL')
          .getRawOne<{ max_order: number }>();
        let next = Number(maxRow?.max_order ?? 0) + 1;
        for (const t of tasksToReset) {
          t.kanbanStatus = TaskKanbanStatus.DRAFT;
          t.displayOrder = next++;
        }
        await txUow.tasks.save(tasksToReset);
      }

      // 4. Flip the project status.
      project.status = ProjectStatus.CONFIGURED;
      await txUow.projects.save(project);

      this.logger.log(
        `republish — refund summary | projectId: ${projectId}, publishFee: ${publishFeeRefund?.amount ?? '0'}, taskRefunds: ${taskRefundTotal.toFixedString()}, tasksReset: ${tasksToReset.length}, newBalance: ${lockedProfile.accountBalance}`,
      );

      return {
        publishFeeRefund,
        taskRefundTotal: taskRefundTotal.toFixedString(),
        firstTaskRefundTxnNumber,
        tasksReset: tasksToReset.length,
      };
    });

    this.logger.log(`republish — complete | projectId: ${projectId}`);

    // Total wallet credit issued = publish fee refund (if any) + per-task
    // refunds (if any). Email + notification fire post-commit so a transient
    // delivery failure cannot roll back the refund.
    const totalRefund = Money.from(result.publishFeeRefund?.amount ?? '0').add(
      Money.from(result.taskRefundTotal),
    );
    const totalRefundString = totalRefund.toFixedString();
    const hasRefund = parseFloat(totalRefundString) > 0;

    if (hasRefund) {
      await this.sendRefundEmail(
        project,
        businessProfile,
        totalRefundString,
        result.publishFeeRefund?.transactionNumber ?? result.firstTaskRefundTxnNumber ?? '—',
      );
    }

    // Fire-and-forget — fires for both refund and CREDIT paths so the user
    // always gets confirmation that the project is back in CONFIGURED state.
    this.notificationsClient.emit(NOTIFICATION_EVENTS.PROJECT_UNPUBLISHED, {
      project_id: project.id,
      project_code: project.code,
      project_title: project.title,
      business_user_id: businessProfile.userId,
      business_id: businessProfile.id,
      ...(hasRefund ? { refund_amount: parseFloat(totalRefundString) } : {}),
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async sendRefundEmail(
    project: Project,
    businessProfile: IBusinessProfileSnapshot,
    refundAmount: string,
    transactionNumber: string,
  ): Promise<void> {
    const user = await this.uow.users.findOne({ where: { id: businessProfile.userId } });
    if (!user?.email) return;

    try {
      const tz = this.requestContext.timezone ?? undefined;
      const refundDate = DateUtil.format(DateUtil.now(tz), 'MMMM D, YYYY', tz);
      const projectDashboardUrl = `${this.env.ployosUrl}/projects/${project.id}`;

      await this.emailService.sendProjectRepublishRefundEmail(user.email, {
        businessName: businessProfile.companyName || 'Business Owner',
        transactionNumber,
        refundDate,
        projectTitle: project.title,
        refundMethod: PaymentMethod.ACCOUNT_BALANCE,
        amount: refundAmount,
        projectDashboardUrl,
      });

      this.logger.log(
        `sendRefundEmail — sent | projectId: ${project.id}, email: ${user.email}, amount: ${refundAmount}, txn: ${transactionNumber}`,
      );
    } catch (err) {
      this.logger.error(
        `sendRefundEmail — failed | projectId: ${project.id}, error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
