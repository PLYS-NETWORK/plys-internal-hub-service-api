import * as ejs from 'ejs';
import * as path from 'path';

export interface IConsultantApplicationSubmittedTemplateOptions {
  readonly userName: string;
}

export async function buildConsultantApplicationSubmittedEmail(
  options: IConsultantApplicationSubmittedTemplateOptions,
): Promise<string> {
  const { userName } = options;

  return ejs.renderFile(path.join(__dirname, 'application-submitted.template.ejs'), {
    userName,
    year: new Date().getFullYear(),
  });
}
