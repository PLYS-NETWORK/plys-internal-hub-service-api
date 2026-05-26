import * as ejs from 'ejs';
import * as path from 'path';

export interface ITopUpCancelledTemplateOptions {
  readonly recipientName: string;
  readonly transactionNumber: string;
  readonly cancelDate: string;
  /** Intended top-up amount, fixed-point string (e.g. '100.00'). */
  readonly amount: string;
  readonly currency: string;
  /** URL to the billing/transactions page. */
  readonly transactionsUrl: string;
}

export async function buildTopUpCancelledEmail(
  options: ITopUpCancelledTemplateOptions,
): Promise<string> {
  const { recipientName, transactionNumber, cancelDate, amount, currency, transactionsUrl } =
    options;

  return ejs.renderFile(path.join(__dirname, 'top-up-cancelled.template.ejs'), {
    recipientName,
    transactionNumber,
    cancelDate,
    amount,
    currency,
    transactionsUrl,
    year: new Date().getFullYear(),
  });
}
