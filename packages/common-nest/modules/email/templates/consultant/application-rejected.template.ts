import * as ejs from 'ejs';
import * as path from 'path';

export interface IConsultantApplicationRejectedTemplateOptions {
  readonly userName: string;
  readonly reason: string;
  readonly blockedUntil: string;
}

export async function buildConsultantApplicationRejectedEmail(
  options: IConsultantApplicationRejectedTemplateOptions,
): Promise<string> {
  const { userName, reason, blockedUntil } = options;

  return ejs.renderFile(path.join(__dirname, 'application-rejected.template.ejs'), {
    userName,
    reason,
    blockedUntil,
    year: new Date().getFullYear(),
  });
}
