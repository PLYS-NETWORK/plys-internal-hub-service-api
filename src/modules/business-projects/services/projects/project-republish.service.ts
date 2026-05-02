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
  ProjectStatus,
  TransactionStatus,
} from '@database/enums';
import { NOTIFICATION_TYPES } from '@modules/notifications/enums/notification-type.enum';
import { NotificationDispatcherService } from '@modules/notifications/services/notification-dispatcher.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { IProjectRepublishService } from '../../interfaces/project-republish.service.interface';
import { BusinessAccessService } from '../business-access.service';

@Injectable()
export class ProjectRepublishService implements IProjectRepublishService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {
    this.logger = new AppLogger(ProjectRepublishService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async republish(projectId: string): Promise<void> {
    const { project, businessProfile } = await this.access.resolveOwnedProject(projectId);
    this.logger.log(
      `[${this.rid}] republish — start | projectId: ${projectId}, businessId: ${businessProfile.id}`,
    );

    if (project.status !== ProjectStatus.PUBLISHED) {
      this.logger.warn(
        `[${this.rid}] republish — wrong status | projectId: ${projectId}, status: ${project.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.invalid_status_transition',
        errorCode: ERROR_CODES.PROJECT_INVALID_STATUS_TRANSITION,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Wallet credit + refund txn + status flip must be atomic; the row lock on
    // the profile prevents a concurrent task-payment from racing with the
    // refund and corrupting the running balance.
    const refundedAmount = await this.uow.withTransaction(async (txUow) => {
      if (businessProfile.allowPaymentCredit) {
        project.status = ProjectStatus.CONFIGURED;
        await txUow.projects.save(project);
        return null;
      }

      const lockedProfile = await txUow.businessProfiles.findByIdForUpdate(businessProfile.id);
      if (!lockedProfile) {
        this.logger.warn(
          `[${this.rid}] republish — profile vanished mid-transaction | businessId: ${businessProfile.id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.business_profile.not_found',
          errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
          status: HttpStatus.FORBIDDEN,
        });
      }

      const originalTxn = await txUow.businessTransactions.findOne({
        where: {
          projectId: project.id,
          type: BusinessTransactionType.PROJECT_PUBLISHED,
          status: TransactionStatus.COMPLETED,
        },
      });
      if (!originalTxn) {
        this.logger.warn(
          `[${this.rid}] republish — original publish transaction not found | projectId: ${projectId}`,
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
      await txUow.businessProfiles.save(lockedProfile);

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

      this.logger.log(
        `[${this.rid}] republish — refund issued | projectId: ${projectId}, amount: ${originalTxn.amount}, newBalance: ${lockedProfile.accountBalance}`,
      );

      project.status = ProjectStatus.CONFIGURED;
      await txUow.projects.save(project);
      return { amount: originalTxn.amount, transactionNumber: refundTxnNumber };
    });

    this.logger.log(`[${this.rid}] republish — complete | projectId: ${projectId}`);

    // Email runs after the transaction commits — refund is already final, so
    // an email failure must not roll back the wallet credit or status flip.
    if (refundedAmount !== null) {
      await this.sendRefundEmail(
        project,
        businessProfile,
        refundedAmount.amount,
        refundedAmount.transactionNumber,
      );
    }

    // Fire-and-forget — fires for both refund and CREDIT paths so the user
    // always gets confirmation that the project is back in CONFIGURED state.
    void this.notificationDispatcher
      .dispatch({
        userId: businessProfile.userId,
        type: NOTIFICATION_TYPES.PROJECT_UNPUBLISHED,
        metadata: {
          project_id: project.id,
          project_code: project.code,
          project_title: project.title,
          ...(refundedAmount !== null ? { refund_amount: parseFloat(refundedAmount.amount) } : {}),
        },
        actorId: this.requestContext.userId ?? null,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${this.rid}] republish — notification dispatch failed | error: ${msg}`);
      });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async sendRefundEmail(
    project: Project,
    businessProfile: BusinessProfile,
    refundAmount: string,
    transactionNumber: string,
  ): Promise<void> {
    const user = await this.uow.users.findOne({ where: { id: businessProfile.userId } });
    if (!user?.email) return;

    try {
      const tz = this.requestContext.timezone ?? undefined;
      const refundDate = DateUtil.format(DateUtil.now(tz), 'MMMM D, YYYY', tz);
      const projectDashboardUrl = `${this.env.ployosUrl}/c/${businessProfile.id}/projects/${project.id}`;

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
        `[${this.rid}] sendRefundEmail — sent | projectId: ${project.id}, email: ${user.email}, amount: ${refundAmount}, txn: ${transactionNumber}`,
      );
    } catch (err) {
      this.logger.error(
        `[${this.rid}] sendRefundEmail — failed | projectId: ${project.id}, error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
