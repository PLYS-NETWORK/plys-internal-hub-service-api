import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import {
  BillingPeriodStatus,
  BusinessTransactionType,
  ConsultantTransactionType,
  InvoiceStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

/**
 * Handles post-payment logic for billing invoices.
 *
 * Called by the webhook handler after Polar/Stripe confirms a successful invoice
 * payment. Runs inside a single transaction to atomically:
 * 1. Verify processorInvoiceId matches to prevent metadata-forgery attacks
 * 2. Mark invoice as PAID
 * 3. Mark the business transaction as COMPLETED
 * 4. Mark the billing period as PAID
 * 5. Credit each consultant whose tasks appear on the invoice
 * 6. Mark consultant transactions as COMPLETED
 */
@Injectable()
export class BillingInvoiceService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BillingInvoiceService.name, requestContext);
  }

  /**
   * Completes invoice payment — credits consultants and updates all statuses.
   * Idempotent: returns early if the invoice is already PAID.
   *
   * @param invoiceId         Internal invoice UUID from webhook metadata.
   * @param transactionId     Internal business transaction UUID from webhook metadata.
   * @param processorInvoiceId The checkout/session ID issued by the processor.
   *                          Must match the stored processorInvoiceId to prevent
   *                          a forged metadata attack from marking an unrelated invoice paid.
   */
  public async completeInvoicePayment(
    invoiceId: string,
    transactionId: string,
    processorInvoiceId: string,
  ): Promise<void> {
    this.logger.log(
      `[${this.rid}] completeInvoicePayment — start | invoiceId: ${invoiceId}, transactionId: ${transactionId}`,
    );

    await this.uow.withTransaction(async (txUow) => {
      // 1. Find and validate invoice
      const invoice = await txUow.invoices.findOne({ where: { id: invoiceId } });
      if (!invoice) {
        this.logger.warn(
          `[${this.rid}] completeInvoicePayment — invoice not found | invoiceId: ${invoiceId}`,
        );
        return;
      }

      if (invoice.status === InvoiceStatus.PAID) {
        this.logger.log(
          `[${this.rid}] completeInvoicePayment — already paid, skipping | invoiceId: ${invoiceId}`,
        );
        return;
      }

      // 2. Verify processorInvoiceId to guard against metadata-forgery attacks.
      // An attacker could craft a webhook with a valid processor event but swap the
      // invoiceId in metadata — this check ties the processor checkout to this invoice.
      if (invoice.processorInvoiceId !== processorInvoiceId) {
        this.logger.error(
          `[${this.rid}] completeInvoicePayment — processorInvoiceId mismatch, aborting | invoiceId: ${invoiceId}, expected: ${invoice.processorInvoiceId}, received: ${processorInvoiceId}`,
        );
        return;
      }

      // 3. Mark invoice as PAID
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = DateUtil.nowDate();
      await txUow.invoices.save(invoice);

      // 4. Mark business transaction as COMPLETED
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

      // 5. Mark billing period as PAID
      const billingPeriod = await txUow.billingPeriods.findOne({
        where: { id: invoice.billingPeriodId },
      });

      if (billingPeriod) {
        billingPeriod.status = BillingPeriodStatus.PAID;
        await txUow.billingPeriods.save(billingPeriod);
      }

      // 6. Find all PENDING consultant transactions linked to this invoice
      const consultantTxns = await txUow.consultantTransactions.find({
        where: {
          invoiceId: invoice.id,
          type: ConsultantTransactionType.CREDIT_PENDING,
          status: TransactionStatus.PENDING,
        },
      });

      // 7. Aggregate payout amounts by consultant and credit balances
      // Why aggregate first: avoids multiple DB writes per consultant when
      // a single invoice contains multiple tasks for the same consultant.
      const creditsByConsultant = new Map<string, number>();

      for (const txn of consultantTxns) {
        const current = creditsByConsultant.get(txn.consultantId) ?? 0;
        creditsByConsultant.set(txn.consultantId, current + Number(txn.amount));
      }

      // 8. Mark each consultant transaction as COMPLETED
      for (const txn of consultantTxns) {
        txn.status = TransactionStatus.COMPLETED;
        await txUow.consultantTransactions.save(txn);
      }

      // 9. Credit each consultant's account balance
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
            `[${this.rid}] completeInvoicePayment — consultant credited | consultantId: ${consultantId}, amount: ${totalCredit.toFixed(2)}, newBalance: ${newBalance}`,
          );
        }
      }
    });

    this.logger.log(
      `[${this.rid}] completeInvoicePayment — complete | invoiceId: ${invoiceId}, transactionId: ${transactionId}`,
    );
  }
}
