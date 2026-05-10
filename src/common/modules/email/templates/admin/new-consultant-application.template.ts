import * as ejs from 'ejs';
import * as path from 'path';

export interface IAdminNewConsultantApplicationTemplateOptions {
  readonly consultantName: string;
  readonly consultantEmail: string;
  readonly submittedAt: string;
  readonly reviewUrl: string;
}

export async function buildAdminNewConsultantApplicationEmail(
  options: IAdminNewConsultantApplicationTemplateOptions,
): Promise<string> {
  const { consultantName, consultantEmail, submittedAt, reviewUrl } = options;

  return ejs.renderFile(path.join(__dirname, 'new-consultant-application.template.ejs'), {
    consultantName,
    consultantEmail,
    submittedAt,
    reviewUrl,
    year: new Date().getFullYear(),
  });
}
