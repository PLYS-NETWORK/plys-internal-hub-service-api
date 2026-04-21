import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessWelcomeTemplateOptions {
  readonly userName: string;
  readonly dashboardUrl: string;
}

export async function buildBusinessWelcomeEmail(
  options: IBusinessWelcomeTemplateOptions,
): Promise<string> {
  const { userName, dashboardUrl } = options;

  return ejs.renderFile(path.join(__dirname, 'welcome.template.ejs'), {
    userName,
    dashboardUrl,
    year: new Date().getFullYear(),
  });
}
