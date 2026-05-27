import * as ejs from 'ejs';
import * as path from 'path';

export interface IConsultantApplicationApprovedTemplateOptions {
  readonly userName: string;
  readonly dashboardUrl: string;
}

export async function buildConsultantApplicationApprovedEmail(
  options: IConsultantApplicationApprovedTemplateOptions,
): Promise<string> {
  const { userName, dashboardUrl } = options;

  return ejs.renderFile(path.join(__dirname, 'application-approved.template.ejs'), {
    userName,
    dashboardUrl,
    year: new Date().getFullYear(),
  });
}
