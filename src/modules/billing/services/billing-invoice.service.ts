import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BillingPeriodStatus } from '@database/enums/billing-period-status.enum';
import { BusinessTransactionType } from '@database/enums/business-transaction-type.enum';
import { ConsultantTransactionType } from '@database/enums/consultant-transaction-type.enum';
import { InvoiceStatus } from '@database/enums/invoice-status.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

/**
 * Handles post-payment logic for billing invoices.
 *
 * Called by the webhook handler after Polar confirms a successful invoice
 * payment. Runs inside a single transaction to atomically:
 * 1. Mark invoice as PAID
 * 2. Mark the business transaction as COMPLETED
 * 3. Mark the billing period as PAID
 * 4. Credit each consultant whose tasks appear on the invoice
 * 5. Mark consultant transactions as COMPLETED
 */
@Injectable()
export class BillingInvoiceService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BillingInvoiceService.name, requestContext);
  }

  /**
   * Completes invoice payment — credits consultants and updates all statuses.
   * Idempotent: returns early if the invoice is already PAID.
   */
  public async completeInvoicePayment(invoiceId: string, transactionId: string): Promise<void> {
    this.logger.log(
      `completeInvoicePayment — start | invoiceId: ${invoiceId}, transactionId: ${transactionId}`,
    );

    await this.uow.withTransaction(async (txUow) => {
      // 1. Find and validate invoice
      const invoice = await txUow.invoices.findOne({ where: { id: invoiceId } });
      if (!invoice) {
        this.logger.warn(`completeInvoicePayment — invoice not found | invoiceId: ${invoiceId}`);
        return;
      }

      if (invoice.status === InvoiceStatus.PAID) {
        this.logger.log(
          `completeInvoicePayment — already paid, skipping | invoiceId: ${invoiceId}`,
        );
        return;
      }

      // 2. Mark invoice as PAID
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = new Date();
      await txUow.invoices.save(invoice);

      // 3. Mark business transaction as COMPLETED
      const businessTxn = await txUow.businessTransactions.findOne({
        where: {
          id: transactionId,
          type: BusinessTransactionType.MONTHLY_BILLING,
        },
      });

      if (businessTxn) {
        businessTxn.status = TransactionStatus.COMPLETED;
        await txUow.businessTransactions.save(businessTxn);
      }

      // 4. Mark billing period as PAID
      const billingPeriod = await txUow.billingPeriods.findOne({
        where: { id: invoice.billingPeriodId },
      });

      if (billingPeriod) {
        billingPeriod.status = BillingPeriodStatus.PAID;
        await txUow.billingPeriods.save(billingPeriod);
      }

      // 5. Find all PENDING consultant transactions linked to this invoice
      const consultantTxns = await txUow.consultantTransactions.find({
        where: {
          invoiceId: invoice.id,
          type: ConsultantTransactionType.CREDIT_PENDING,
          status: TransactionStatus.PENDING,
        },
      });

      // 6. Aggregate payout amounts by consultant and credit balances
      // Why aggregate first: avoids multiple DB writes per consultant when
      // a single invoice contains multiple tasks for the same consultant.
      const creditsByConsultant = new Map<string, number>();

      for (const txn of consultantTxns) {
        const current = creditsByConsultant.get(txn.consultantId) ?? 0;
        creditsByConsultant.set(txn.consultantId, current + Number(txn.amount));
      }

      // 7. Mark each consultant transaction as COMPLETED
      for (const txn of consultantTxns) {
        txn.status = TransactionStatus.COMPLETED;
        await txUow.consultantTransactions.save(txn);
      }

      // 8. Credit each consultant's account balance
      for (const [consultantId, totalCredit] of creditsByConsultant) {
        const consultantProfile = await txUow.consultantProfiles.findOne({
          where: { id: consultantId },
        });

        if (consultantProfile) {
          const currentBalance = parseFloat(consultantProfile.accountBalance);
          const newBalance = (currentBalance + totalCredit).toFixed(2);

          await txUow.consultantProfiles.update(consultantId, {
            accountBalance: newBalance,
          });

          this.logger.log(
            `completeInvoicePayment — consultant credited | consultantId: ${consultantId}, amount: ${totalCredit.toFixed(2)}, newBalance: ${newBalance}`,
          );
        }
      }
    });

    this.logger.log(
      `completeInvoicePayment — complete | invoiceId: ${invoiceId}, transactionId: ${transactionId}`,
    );
  }
}
