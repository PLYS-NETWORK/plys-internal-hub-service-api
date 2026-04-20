import * as ejs from 'ejs';
import * as path from 'path';

export interface IApplicationNotificationTemplateOptions {
  /** Recipient name (business company name or consultant full name). */
  readonly recipientName: string;
  readonly projectTitle: string;
  readonly consultantFullName: string;
  /** Translated skill names that matched. */
  readonly matchedSkills: string[];
  /** Formatted consultant address string. */
  readonly consultantAddress: string;
  /** Link to view the application on the business platform. Only provided for business recipients. */
  readonly applicationUrl?: string;
}

export async function buildApplicationNotificationEmail(
  options: IApplicationNotificationTemplateOptions,
): Promise<string> {
  const {
    recipientName,
    projectTitle,
    consultantFullName,
    matchedSkills,
    consultantAddress,
    applicationUrl,
  } = options;

  return ejs.renderFile(path.join(__dirname, 'application-notification.template.ejs'), {
    recipientName,
    projectTitle,
    consultantFullName,
    matchedSkills,
    consultantAddress,
    applicationUrl: applicationUrl ?? null,
    year: new Date().getFullYear(),
  });
}
