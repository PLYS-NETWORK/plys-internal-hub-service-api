import * as ejs from 'ejs';
import * as path from 'path';

export interface IAiDetectedTemplateOptions {
  readonly userName: string;
  readonly projectTitle: string;
}

export async function buildAiDetectedEmail(options: IAiDetectedTemplateOptions): Promise<string> {
  const { userName, projectTitle } = options;

  return ejs.renderFile(path.join(__dirname, 'ai-detected.template.ejs'), {
    userName,
    projectTitle,
    year: new Date().getFullYear(),
  });
}
