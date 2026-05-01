import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Task } from '@database/entities';
import {
  BusinessTransactionType,
  ConsultantTransactionType,
  TaskKanbanStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { IBusinessProfileSnapshot } from '../interfaces/task-access.service.interface';
import { ITaskPaymentService } from '../interfaces/task-payment.service.interface';

@Injectable()
export class TaskPaymentService implements ITaskPaymentService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** @inheritdoc */
  public async chargeForActivation(
    task: Task,
    businessProfile: IBusinessProfileSnapshot,
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

        const priceStr = price.toFixed(2);
        const transactionNumber = await txUow.transactionNumbers.next(
          'PLS',
          BusinessTransactionType.TASK_ADDED,
        );
        const txn = txUow.businessTransactions.create({
          transactionNumber,
          businessId: businessProfile.id,
          type: BusinessTransactionType.TASK_ADDED,
          amount: priceStr,
          totalAmount: priceStr,
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

  /** @inheritdoc */
  public async payoutForCompletion(
    task: Task,
    businessProfile: IBusinessProfileSnapshot,
  ): Promise<Task> {
    const userId = this.requestContext.userId!;

    return this.uow.withTransaction(async (txUow) => {
      task.kanbanStatus = TaskKanbanStatus.DONE;
      task.approvedBy = userId;
      task.approvedAt = DateUtil.nowDate();

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

            const transactionNumber = await txUow.transactionNumbers.next(
              'LN',
              ConsultantTransactionType.CREDIT_CLEARED,
            );
            const txn = txUow.consultantTransactions.create({
              transactionNumber,
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
            const transactionNumber = await txUow.transactionNumbers.next(
              'LN',
              ConsultantTransactionType.CREDIT_PENDING,
            );
            const txn = txUow.consultantTransactions.create({
              transactionNumber,
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
}
