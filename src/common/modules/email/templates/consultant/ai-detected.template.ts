import * as ejs from 'ejs';
import * as path from 'path';

export interface IConsultantAiDetectedTemplateOptions {
  readonly userName: string;
  readonly projectTitle: string;
}

export async function buildConsultantAiDetectedEmail(
  options: IConsultantAiDetectedTemplateOptions,
): Promise<string> {
  const { userName, projectTitle } = options;

  return ejs.renderFile(path.join(__dirname, 'ai-detected.template.ejs'), {
    userName,
    projectTitle,
    year: new Date().getFullYear(),
  });
}
