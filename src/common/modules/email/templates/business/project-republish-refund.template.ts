import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessProjectRepublishRefundTemplateOptions {
  readonly businessName: string;
  /** Short, collision-resistant identifier for the refund — e.g. `PLY-RF-AB12CD34`. */
  readonly transactionNumber: string;
  readonly refundDate: string;
  readonly projectTitle: string;
  /** Where the refund landed — e.g. 'Account Balance'. Mirrors the receipt template's vocabulary. */
  readonly refundMethod: string;
  /** Refund amount, fixed-point string (e.g. '125.00'). */
  readonly amount: string;
  readonly projectDashboardUrl: string;
}

export async function buildBusinessProjectRepublishRefundEmail(
  options: IBusinessProjectRepublishRefundTemplateOptions,
): Promise<string> {
  const {
    businessName,
    transactionNumber,
    refundDate,
    projectTitle,
    refundMethod,
    amount,
    projectDashboardUrl,
  } = options;

  return ejs.renderFile(path.join(__dirname, 'project-republish-refund.template.ejs'), {
    businessName,
    transactionNumber,
    refundDate,
    projectTitle,
    refundMethod,
    amount,
    projectDashboardUrl,
    year: new Date().getFullYear(),
  });
}
