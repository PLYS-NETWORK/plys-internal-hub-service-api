import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessProjectPublishedReceiptTemplateOptions {
  readonly businessName: string;
  readonly transactionNumber: string;
  readonly paidDate: string;
  readonly projectTitle: string;
  /** How the business paid — e.g. 'Account Balance', 'Credit Card'. Never hardcode at call site. */
  readonly paymentMethod: string;
  /** Task subtotal before commission. */
  readonly amount: string;
  /** Commission rate as a display percentage string, e.g. '25.00'. */
  readonly commissionRate: string;
  /** Commission amount charged on top of the task subtotal. */
  readonly commissionAmount: string;
  /** Total amount charged = amount + commissionAmount. */
  readonly totalAmount: string;
  readonly projectDashboardUrl: string;
  readonly invoiceDownloadUrl?: string;
}

export async function buildBusinessProjectPublishedReceiptEmail(
  options: IBusinessProjectPublishedReceiptTemplateOptions,
): Promise<string> {
  const {
    businessName,
    transactionNumber,
    paidDate,
    projectTitle,
    paymentMethod,
    amount,
    commissionRate,
    commissionAmount,
    totalAmount,
    projectDashboardUrl,
    invoiceDownloadUrl = '#',
  } = options;

  return ejs.renderFile(path.join(__dirname, 'project-published-receipt.template.ejs'), {
    businessName,
    transactionNumber,
    paidDate,
    projectTitle,
    paymentMethod,
    amount,
    commissionRate,
    commissionAmount,
    totalAmount,
    projectDashboardUrl,
    invoiceDownloadUrl,
    year: new Date().getFullYear(),
  });
}
