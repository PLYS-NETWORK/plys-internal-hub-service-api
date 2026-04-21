import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessApplicationNotificationTemplateOptions {
  /** Business owner's company name. */
  readonly recipientName: string;
  readonly projectTitle: string;
  readonly consultantFullName: string;
  /** Translated skill names that matched. */
  readonly matchedSkills: string[];
  /** Formatted consultant address string. */
  readonly consultantAddress: string;
  /** Link to view the application on the Ployos platform. */
  readonly applicationUrl: string;
}

export async function buildBusinessApplicationNotificationEmail(
  options: IBusinessApplicationNotificationTemplateOptions,
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
    applicationUrl,
    year: new Date().getFullYear(),
  });
}
