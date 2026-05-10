import * as ejs from 'ejs';
import * as path from 'path';

export interface IWithdrawCancelledTemplateOptions {
  readonly recipientName: string;
  readonly transactionNumber: string;
  readonly cancelDate: string;
  /** Amount restored to the account balance, fixed-point string (e.g. '250.00'). */
  readonly restoredAmount: string;
  readonly currency: string;
  /** URL to the billing/transactions page for the user. */
  readonly transactionsUrl: string;
}

export async function buildWithdrawCancelledEmail(
  options: IWithdrawCancelledTemplateOptions,
): Promise<string> {
  const {
    recipientName,
    transactionNumber,
    cancelDate,
    restoredAmount,
    currency,
    transactionsUrl,
  } = options;

  return ejs.renderFile(path.join(__dirname, 'withdraw-cancelled.template.ejs'), {
    recipientName,
    transactionNumber,
    cancelDate,
    restoredAmount,
    currency,
    transactionsUrl,
    year: new Date().getFullYear(),
  });
}
