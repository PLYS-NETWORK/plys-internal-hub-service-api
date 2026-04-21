import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessProjectPublishedSuccessTemplateOptions {
  readonly businessName: string;
  readonly projectTitle: string;
  readonly projectHubUrl: string;
}

export async function buildBusinessProjectPublishedSuccessEmail(
  options: IBusinessProjectPublishedSuccessTemplateOptions,
): Promise<string> {
  const { businessName, projectTitle, projectHubUrl } = options;

  return ejs.renderFile(path.join(__dirname, 'project-published-success.template.ejs'), {
    businessName,
    projectTitle,
    projectHubUrl,
    year: new Date().getFullYear(),
  });
}
