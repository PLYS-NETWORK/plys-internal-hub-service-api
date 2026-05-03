import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { ConsultantTransaction } from '@database/entities/finance/consultant-transaction.entity';
import { Invoice } from '@database/entities/finance/invoice.entity';
import {
  BillingPeriodStatus,
  BusinessTransactionType,
  ConsultantTransactionType,
  InvoiceStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, IsNull } from 'typeorm';

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
  readonly commissionRate: number;
  readonly commissionAmount: number;
  readonly invoiceTotal: number;
  readonly dueDate: Date;
  readonly pendingTxns: ConsultantTransaction[];
}

/**
 * Monthly settlement cron for credit-based businesses.
 *
 * On the 1st of every month at 08:00, runs two phases:
 *
 * Phase 1 — createMonthlyInvoices: for every business with CREDIT_PENDING
 *   consultant transactions in the previous month, atomically creates:
 *   invoice, line items, business transaction, billing period finalisation.
 *
 * Phase 2 — dispatchPendingInvoiceEmails: queries invoices from that period
 *   where notifiedAt IS NULL and attempts email delivery. Each success stamps
 *   notifiedAt, making the phase idempotent and retryable.
 *
 * Consultants are NOT credited here — they receive payment only after the
 * business settles the invoice via the payment checkout flow.
 */
@Injectable()
export class BillingSettlementService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BillingSettlementService.name, requestContext);
  }

  @Cron('0 8 1 * *')
  public async settleMonthlyCredits(): Promise<void> {
    const tz = this.requestContext.timezone ?? undefined;
    const prevMonthDate = DateUtil.subtract(DateUtil.now(tz), 1, 'month', tz);
    const prevMonth = prevMonthDate.month(); // dayjs months are 0-indexed
    const prevYear = prevMonthDate.year();

    // Phase 1: create all invoices for the period
    await this.runSettlement(prevYear, prevMonth);

    // Phase 2: send emails for invoices without a notifiedAt stamp
    await this.dispatchPendingInvoiceEmails(prevYear, prevMonth);
  }

  /**
   * Core settlement logic — shared by the cron and the admin manual trigger.
   *
   * @param year  Full year (e.g. 2026)
   * @param month 0-indexed month (0 = January … 11 = December)
   * @param businessId Optional: settle only this business; if omitted settle all.
   */
  public async runSettlement(year: number, month: number, businessId?: string): Promise<void> {
    this.logger.log(
      `runSettlement — start | year: ${year}, month: ${month + 1}${businessId ? `, businessId: ${businessId}` : ''}`,
    );

    const pendingTxns = await this.uow.consultantTransactions.find({
      where: {
        type: ConsultantTransactionType.CREDIT_PENDING,
        status: TransactionStatus.PENDING,
      },
      relations: { task: { project: true } },
    });

    // Filter to requested period and optionally to a single business
    const byBusiness = new Map<string, typeof pendingTxns>();

    for (const txn of pendingTxns) {
      if (!txn.task || !txn.task.project) continue;

      const createdMonth = txn.createdAt.getMonth();
      const createdYear = txn.createdAt.getFullYear();
      if (createdMonth !== month || createdYear !== year) continue;

      const bid = txn.task.project.businessId;
      if (businessId && bid !== businessId) continue;

      const list = byBusiness.get(bid) ?? [];
      list.push(txn);
      byBusiness.set(bid, list);
    }

    this.logger.log(
      `runSettlement — found ${pendingTxns.length} pending transactions across ${byBusiness.size} businesses`,
    );

    for (const [bid, txns] of byBusiness) {
      // Idempotency guard: skip businesses that already have an invoice for this period
      const sqlMonth = month + 1;
      const periodStart = `${year}-${String(sqlMonth).padStart(2, '0')}-01`;
      const existing = await this.uow.invoices.findOne({
        where: { billingPeriod: { businessId: bid, periodStart } },
        relations: { billingPeriod: true },
      });
      if (existing) {
        this.logger.warn(`runSettlement — invoice already exists, skipping | businessId: ${bid}`);
        continue;
      }

      try {
        await this.settleBusinessCredits(bid, txns, year, month);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`runSettlement — failed for business ${bid} | error: ${message}`);
      }
    }

    this.logger.log(`runSettlement — complete`);
  }

  /**
   * Sends the monthly invoice email for a single invoice.
   * Sets invoice.notifiedAt on success. Failures are logged but not thrown.
   * Called by both the cron phase 2 and the admin manual send endpoint.
   */
  public async sendInvoiceEmail(invoice: Invoice): Promise<void> {
    const invoiceWithRelations = await this.uow.invoices.findOne({
      where: { id: invoice.id },
      relations: { billingPeriod: true },
    });

    if (!invoiceWithRelations?.billingPeriod) {
      this.logger.warn(`sendInvoiceEmail — billingPeriod not found | invoiceId: ${invoice.id}`);
      return;
    }

    const businessProfile = await this.uow.businessProfiles.findOne({
      where: { id: invoiceWithRelations.businessId },
      relations: { user: true },
    });

    if (!businessProfile?.user?.email) {
      this.logger.warn(
        `sendInvoiceEmail — no email for business | businessId: ${invoiceWithRelations.businessId}`,
      );
      return;
    }

    // Load line items with task titles for the email body
    const lineItems = await this.uow.invoiceLineItems.find({
      where: { invoiceId: invoiceWithRelations.id },
      relations: { task: true },
    });

    // Derive month/year from billing period start date (format: YYYY-MM-DD)
    const periodStart = new Date(invoiceWithRelations.billingPeriod.periodStart);
    const month = periodStart.getMonth(); // 0-indexed
    const year = periodStart.getFullYear();

    const tz = this.requestContext.timezone ?? undefined;
    const dueDate = invoiceWithRelations.dueDate
      ? DateUtil.format(invoiceWithRelations.dueDate, 'MMMM D, YYYY', tz)
      : '';

    // Use the snapshotted breakdown stored on the invoice — no reverse-computation needed.
    const taskTotal = invoiceWithRelations.taskTotal;
    const commissionAmount = invoiceWithRelations.commissionAmount;

    // The MONTHLY_BILLING txn was written in the same xact as the invoice, so
    // exactly one row matches. Quoting `transaction_number` on the email gives
    // support a stable lookup id.
    const settlementTxn = await this.uow.businessTransactions.findOne({
      where: {
        invoiceId: invoiceWithRelations.id,
        type: BusinessTransactionType.MONTHLY_BILLING,
      },
    });
    if (!settlementTxn) {
      this.logger.warn(
        `sendInvoiceEmail — no MONTHLY_BILLING txn found | invoiceId: ${invoiceWithRelations.id}`,
      );
      return;
    }

    try {
      await this.emailService.sendMonthlyInvoiceEmail(businessProfile.user.email, {
        businessName: businessProfile.companyName,
        transactionNumber: settlementTxn.transactionNumber,
        billingPeriod: `${MONTH_NAMES[month]} ${year}`,
        dueDate,
        taskTotal,
        commissionAmount,
        invoiceTotal: invoiceWithRelations.amount,
        lineItems: lineItems.map((item) => ({
          taskName: item.task?.title ?? 'Task settlement',
          amount: item.amount,
        })),
        payInvoiceUrl: `${this.env.ployosUrl}/c/${businessProfile.id}/transactions`,
      });

      // Stamp notifiedAt so this invoice is skipped in future dispatch runs
      await this.uow.invoices.update(invoiceWithRelations.id, { notifiedAt: DateUtil.nowDate() });

      this.logger.log(`sendInvoiceEmail — complete | invoiceId: ${invoiceWithRelations.id}`);
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : String(emailError);
      this.logger.error(
        `sendInvoiceEmail — failed | invoiceId: ${invoiceWithRelations.id}, error: ${message}`,
      );
    }
  }

  /**
   * Phase 2 of the monthly cron: sends emails for all invoices in the given period
   * that have not yet received a notification (notifiedAt IS NULL).
   * Idempotent — safe to run multiple times; already-notified invoices are skipped.
   */
  public async dispatchPendingInvoiceEmails(year: number, month: number): Promise<void> {
    const sqlMonth = month + 1;
    const periodStart = `${year}-${String(sqlMonth).padStart(2, '0')}-01`;

    this.logger.log(`dispatchPendingInvoiceEmails — start | period: ${periodStart}`);

    const unnotifiedInvoices = await this.uow.invoices.find({
      where: {
        notifiedAt: IsNull(),
        status: InvoiceStatus.PENDING,
        billingPeriod: { periodStart },
      },
      relations: { billingPeriod: true },
    });

    this.logger.log(
      `dispatchPendingInvoiceEmails — found ${unnotifiedInvoices.length} unnotified invoices`,
    );

    let sent = 0;
    let failed = 0;

    for (const invoice of unnotifiedInvoices) {
      try {
        await this.sendInvoiceEmail(invoice);
        sent++;
      } catch {
        failed++;
      }
    }

    this.logger.log(`dispatchPendingInvoiceEmails — complete | sent: ${sent}, failed: ${failed}`);
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

    await this.uow.withTransaction(async (txUow) => {
      // 1. Load the business commission rate — snapshot at invoice creation time
      // so future rate changes don't alter historical invoices.
      const businessProfile = await txUow.businessProfiles.findOne({
        where: { id: businessId },
      });
      const commissionRate = Number(businessProfile?.commissionRate ?? 0.25);

      // 2. Calculate invoice totals
      // taskTotal = sum of task prices (what the business owes for completed tasks)
      // Why non-null assertions: caller filters out transactions with null task/project
      let taskTotal = 0;
      for (const txn of pendingTxns) {
        taskTotal += Number(txn.task!.price);
      }

      const commissionAmount = taskTotal * commissionRate;
      const invoiceTotal = taskTotal + commissionAmount;

      // 3. Get or create billing period via SQL function (race-safe)
      // month is 0-indexed from JS, SQL function expects 1-indexed
      const sqlMonth = month + 1;
      const periodResult = await this.dataSource.query(
        'SELECT get_or_create_billing_period($1, $2, $3) AS id',
        [businessId, year, sqlMonth],
      );
      const billingPeriodId = periodResult[0].id as string;

      // 4. Create invoice — store the rate snapshot and full breakdown explicitly
      const dueDate = new Date(year, month + 1, 15); // 15th of current month
      const invoice = txUow.invoices.create({
        billingPeriodId,
        businessId,
        taskTotal: taskTotal.toFixed(2),
        commissionRate: commissionRate.toFixed(4),
        commissionAmount: commissionAmount.toFixed(2),
        amount: invoiceTotal.toFixed(2),
        status: InvoiceStatus.PENDING,
        dueDate: dueDate.toISOString().split('T')[0],
      });
      const savedInvoice = await txUow.invoices.save(invoice);

      // 5. Link consultant transactions to this invoice (keep PENDING)
      // Why: consultant transactions stay PENDING until the business pays the
      // invoice. The webhook handler uses invoiceId to find and credit them.
      for (const txn of pendingTxns) {
        const entity = await txUow.consultantTransactions.findOne({ where: { id: txn.id } });
        if (entity) {
          entity.invoiceId = savedInvoice.id;
          await txUow.consultantTransactions.save(entity);
        }
      }

      // 6. Create line items per settled task
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

      // 7. Create business transaction for the invoice
      const businessTxnNumber = await txUow.transactionNumbers.next(
        'PLS',
        BusinessTransactionType.MONTHLY_BILLING,
      );
      const businessTxn = txUow.businessTransactions.create({
        transactionNumber: businessTxnNumber,
        businessId,
        type: BusinessTransactionType.MONTHLY_BILLING,
        amount: taskTotal.toFixed(2),
        commissionRate: commissionRate.toFixed(4),
        commissionAmount: commissionAmount.toFixed(2),
        totalAmount: invoiceTotal.toFixed(2),
        status: TransactionStatus.PENDING,
        invoiceId: savedInvoice.id,
        note: `Monthly billing: ${year}-${String(sqlMonth).padStart(2, '0')} (tasks: ${taskTotal.toFixed(2)} + commission ${(commissionRate * 100).toFixed(0)}%: ${commissionAmount.toFixed(2)})`,
      });
      await txUow.businessTransactions.save(businessTxn);

      // 8. Update billing period
      const billingPeriod = await txUow.billingPeriods.findOne({
        where: { id: billingPeriodId },
      });
      if (billingPeriod) {
        billingPeriod.status = BillingPeriodStatus.FINALIZED;
        billingPeriod.totalAmount = invoiceTotal.toFixed(2);
        billingPeriod.finalizedAt = DateUtil.nowDate();
        await txUow.billingPeriods.save(billingPeriod);
      }

      return {
        invoice: savedInvoice,
        taskTotal,
        commissionRate,
        commissionAmount,
        invoiceTotal,
        dueDate,
        pendingTxns,
      } satisfies ISettlementResult;
    });

    this.logger.log(`settleBusinessCredits — complete | businessId: ${businessId}`);
  }
}
