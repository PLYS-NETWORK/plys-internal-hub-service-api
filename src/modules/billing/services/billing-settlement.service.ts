import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { ConsultantTransaction } from '@database/entities/finance/consultant-transaction.entity';
import { Invoice } from '@database/entities/finance/invoice.entity';
import { BillingPeriodStatus } from '@database/enums/billing-period-status.enum';
import { BusinessTransactionType } from '@database/enums/business-transaction-type.enum';
import { ConsultantTransactionType } from '@database/enums/consultant-transaction-type.enum';
import { InvoiceStatus } from '@database/enums/invoice-status.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

interface ISettlementResult {
  readonly invoice: Invoice;
  readonly taskTotal: number;
  readonly commissionAmount: number;
  readonly invoiceTotal: number;
  readonly dueDate: Date;
  readonly pendingTxns: ConsultantTransaction[];
}

/**
 * Monthly settlement cron for credit-based businesses.
 *
 * On the 1st of every month at 08:00:
 * 1. Find all CREDIT_PENDING consultant transactions from the previous month
 * 2. Group by business → settle each business atomically:
 *    a. Generate invoice with 25% platform commission ON TOP
 *    b. Link consultant transactions to the invoice (keep PENDING)
 *    c. Create business transaction for the invoice total
 *    d. Set billing period to FINALIZED
 *    e. Send email notification to business
 *
 * Consultants are NOT credited here — they receive payment only after the
 * business settles the invoice via the payment checkout flow.
 */
@Injectable()
export class BillingSettlementService {
  private readonly logger = new Logger(BillingSettlementService.name);

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
  ) {}

  @Cron('0 8 1 * *')
  public async settleMonthlyCredits(): Promise<void> {
    this.logger.log('settleMonthlyCredits — start');

    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    // Find all pending consultant transactions from previous month linked to
    // tasks in in_progress projects owned by credit-based businesses
    const pendingTxns = await this.uow.consultantTransactions.find({
      where: {
        type: ConsultantTransactionType.CREDIT_PENDING,
        status: TransactionStatus.PENDING,
      },
      relations: { task: { project: true } },
    });

    // Filter to previous month and group by business
    const byBusiness = new Map<string, typeof pendingTxns>();

    for (const txn of pendingTxns) {
      if (!txn.task || !txn.task.project) continue;

      const createdMonth = txn.createdAt.getMonth();
      const createdYear = txn.createdAt.getFullYear();
      if (createdMonth !== prevMonth || createdYear !== prevYear) continue;

      const businessId = txn.task.project.businessId;
      const list = byBusiness.get(businessId) ?? [];
      list.push(txn);
      byBusiness.set(businessId, list);
    }

    this.logger.log(
      `settleMonthlyCredits — found ${pendingTxns.length} pending transactions across ${byBusiness.size} businesses`,
    );

    for (const [businessId, txns] of byBusiness) {
      try {
        await this.settleBusinessCredits(businessId, txns, prevYear, prevMonth);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `settleMonthlyCredits — failed for business ${businessId} | error: ${message}`,
        );
      }
    }

    this.logger.log('settleMonthlyCredits — complete');
  }

  private async settleBusinessCredits(
    businessId: string,
    pendingTxns: ConsultantTransaction[],
    year: number,
    month: number,
  ): Promise<void> {
    this.logger.log(
      `settleBusinessCredits — start | businessId: ${businessId}, transactions: ${pendingTxns.length}`,
    );

    // Why transaction returns data: email is sent after commit so a failure
    // does not roll back the invoice. The transaction block returns all data
    // needed for the notification.
    const result = await this.uow.withTransaction(async (txUow) => {
      // 1. Calculate invoice totals
      // taskTotal = sum of task prices (what the business owes for completed tasks)
      // Why non-null assertions: caller filters out transactions with null task/project
      let taskTotal = 0;
      for (const txn of pendingTxns) {
        taskTotal += Number(txn.task!.price);
      }

      const commissionAmount = taskTotal * 0.25; // 25% platform fee ON TOP
      const invoiceTotal = taskTotal + commissionAmount;

      // 2. Get or create billing period via SQL function (race-safe)
      // month is 0-indexed from JS, SQL function expects 1-indexed
      const sqlMonth = month + 1;
      const periodResult = await this.dataSource.query(
        'SELECT get_or_create_billing_period($1, $2, $3) AS id',
        [businessId, year, sqlMonth],
      );
      const billingPeriodId = periodResult[0].id as string;

      // 3. Create invoice
      const dueDate = new Date(year, month + 1, 15); // 15th of current month
      const invoice = txUow.invoices.create({
        billingPeriodId,
        businessId,
        amount: invoiceTotal.toFixed(2),
        status: InvoiceStatus.PENDING,
        dueDate: dueDate.toISOString().split('T')[0],
      });
      const savedInvoice = await txUow.invoices.save(invoice);

      // 4. Link consultant transactions to this invoice (keep PENDING)
      // Why: consultant transactions stay PENDING until the business pays the
      // invoice. The webhook handler uses invoiceId to find and credit them.
      for (const txn of pendingTxns) {
        const entity = await txUow.consultantTransactions.findOne({ where: { id: txn.id } });
        if (entity) {
          entity.invoiceId = savedInvoice.id;
          await txUow.consultantTransactions.save(entity);
        }
      }

      // 5. Create line items per settled task
      for (const txn of pendingTxns) {
        const lineItem = txUow.invoiceLineItems.create({
          invoiceId: savedInvoice.id,
          taskId: txn.task!.id,
          consultantId: txn.consultantId,
          projectId: txn.task!.project!.id,
          description: `Task settlement`,
          amount: Number(txn.task!.price).toFixed(2),
          platformFeeAmount: Number(txn.task!.platformFeeAmount).toFixed(2),
          consultantPayout: Number(txn.task!.consultantPayout).toFixed(2),
        });
        await txUow.invoiceLineItems.save(lineItem);
      }

      // 6. Create business transaction for the invoice
      const businessTxn = txUow.businessTransactions.create({
        businessId,
        type: BusinessTransactionType.MONTHLY_BILLING,
        amount: invoiceTotal.toFixed(2),
        status: TransactionStatus.PENDING,
        invoiceId: savedInvoice.id,
        note: `Monthly billing: ${year}-${String(sqlMonth).padStart(2, '0')} (tasks: ${taskTotal.toFixed(2)} + commission: ${commissionAmount.toFixed(2)})`,
      });
      await txUow.businessTransactions.save(businessTxn);

      // 7. Update billing period
      const billingPeriod = await txUow.billingPeriods.findOne({
        where: { id: billingPeriodId },
      });
      if (billingPeriod) {
        billingPeriod.status = BillingPeriodStatus.FINALIZED;
        billingPeriod.totalAmount = invoiceTotal.toFixed(2);
        billingPeriod.finalizedAt = new Date();
        await txUow.billingPeriods.save(billingPeriod);
      }

      return {
        invoice: savedInvoice,
        taskTotal,
        commissionAmount,
        invoiceTotal,
        dueDate,
        pendingTxns,
      } satisfies ISettlementResult;
    });

    // Send email notification after transaction commits (best-effort)
    await this.sendInvoiceNotification(businessId, result, year, month);

    this.logger.log(`settleBusinessCredits — complete | businessId: ${businessId}`);
  }

  /**
   * Sends the monthly invoice email to the business owner.
   * Failures are logged but do not propagate — the invoice is already persisted.
   */
  private async sendInvoiceNotification(
    businessId: string,
    settlement: ISettlementResult,
    year: number,
    month: number,
  ): Promise<void> {
    const businessProfile = await this.uow.businessProfiles.findOne({
      where: { id: businessId },
      relations: { user: true },
    });

    if (!businessProfile?.user?.email) {
      this.logger.warn(`settleBusinessCredits — no email for business | businessId: ${businessId}`);
      return;
    }

    try {
      await this.emailService.sendMonthlyInvoiceEmail(businessProfile.user.email, {
        businessName: businessProfile.companyName,
        invoiceNumber: settlement.invoice.id,
        billingPeriod: `${MONTH_NAMES[month]} ${year}`,
        dueDate: settlement.dueDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        taskTotal: settlement.taskTotal.toFixed(2),
        commissionAmount: settlement.commissionAmount.toFixed(2),
        invoiceTotal: settlement.invoiceTotal.toFixed(2),
        lineItems: settlement.pendingTxns.map((txn) => ({
          taskName: txn.task?.title ?? 'Task settlement',
          amount: Number(txn.task!.price).toFixed(2),
        })),
        payInvoiceUrl: `${this.env.ployosUrl}/billing/invoices/${settlement.invoice.id}/pay`,
      });
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : String(emailError);
      this.logger.error(
        `settleBusinessCredits — email failed | businessId: ${businessId}, error: ${message}`,
      );
    }
  }
}
