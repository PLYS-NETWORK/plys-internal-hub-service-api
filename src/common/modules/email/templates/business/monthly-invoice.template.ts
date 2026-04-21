import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessMonthlyInvoiceTemplateOptions {
  readonly businessName: string;
  readonly invoiceNumber: string;
  readonly billingPeriod: string;
  readonly dueDate: string;
  readonly taskTotal: string;
  readonly commissionAmount: string;
  readonly invoiceTotal: string;
  readonly lineItems: ReadonlyArray<{
    readonly taskName: string;
    readonly amount: string;
  }>;
  readonly payInvoiceUrl: string;
}

export async function buildBusinessMonthlyInvoiceEmail(
  options: IBusinessMonthlyInvoiceTemplateOptions,
): Promise<string> {
  const {
    businessName,
    invoiceNumber,
    billingPeriod,
    dueDate,
    taskTotal,
    commissionAmount,
    invoiceTotal,
    lineItems,
    payInvoiceUrl,
  } = options;

  return ejs.renderFile(path.join(__dirname, 'monthly-invoice.template.ejs'), {
    businessName,
    invoiceNumber,
    billingPeriod,
    dueDate,
    taskTotal,
    commissionAmount,
    invoiceTotal,
    lineItems,
    payInvoiceUrl,
    year: new Date().getFullYear(),
  });
}
