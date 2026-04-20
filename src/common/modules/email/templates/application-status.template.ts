import * as ejs from 'ejs';
import * as path from 'path';

export interface IApplicationStatusTemplateOptions {
  readonly consultantName: string;
  readonly projectTitle: string;
  readonly status: 'approved' | 'rejected';
  /** Only provided when status is 'rejected'. */
  readonly rejectionReason?: string;
  /** Link to the project on the consultant platform (Lona). Only for approved. */
  readonly projectUrl?: string;
}

export async function buildApplicationStatusEmail(
  options: IApplicationStatusTemplateOptions,
): Promise<string> {
  const { consultantName, projectTitle, status, rejectionReason, projectUrl } = options;

  return ejs.renderFile(path.join(__dirname, 'application-status.template.ejs'), {
    consultantName,
    projectTitle,
    status,
    rejectionReason: rejectionReason ?? null,
    projectUrl: projectUrl ?? null,
    year: new Date().getFullYear(),
  });
}
