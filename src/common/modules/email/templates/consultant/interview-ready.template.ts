import * as ejs from 'ejs';
import * as path from 'path';

export interface IConsultantInterviewReadyTemplateOptions {
  readonly userName: string;
  readonly interviewUrl: string;
}

export async function buildConsultantInterviewReadyEmail(
  options: IConsultantInterviewReadyTemplateOptions,
): Promise<string> {
  const { userName, interviewUrl } = options;

  return ejs.renderFile(path.join(__dirname, 'interview-ready.template.ejs'), {
    userName,
    interviewUrl,
    year: new Date().getFullYear(),
  });
}
