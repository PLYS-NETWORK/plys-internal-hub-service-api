import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessProjectPublishedReceiptTemplateOptions {
  readonly businessName: string;
  readonly receiptNumber: string;
  readonly paidDate: string;
  readonly projectTitle: string;
  readonly paymentMethod: string;
  readonly amount: string;
  readonly projectDashboardUrl: string;
  readonly invoiceDownloadUrl?: string;
}

export async function buildBusinessProjectPublishedReceiptEmail(
  options: IBusinessProjectPublishedReceiptTemplateOptions,
): Promise<string> {
  const {
    businessName,
    receiptNumber,
    paidDate,
    projectTitle,
    paymentMethod,
    amount,
    projectDashboardUrl,
    invoiceDownloadUrl = '#',
  } = options;

  return ejs.renderFile(path.join(__dirname, 'project-published-receipt.template.ejs'), {
    businessName,
    receiptNumber,
    paidDate,
    projectTitle,
    paymentMethod,
    amount,
    projectDashboardUrl,
    invoiceDownloadUrl,
    year: new Date().getFullYear(),
  });
}
