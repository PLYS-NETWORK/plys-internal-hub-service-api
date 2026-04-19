import * as ejs from 'ejs';
import * as path from 'path';

export interface IWelcomeTemplateOptions {
  readonly userName: string;
  readonly loginUrl: string;
}

export async function buildWelcomeEmail(options: IWelcomeTemplateOptions): Promise<string> {
  const { userName, loginUrl } = options;

  return ejs.renderFile(path.join(__dirname, 'welcome.template.ejs'), {
    userName,
    loginUrl,
    year: new Date().getFullYear(),
  });
}
