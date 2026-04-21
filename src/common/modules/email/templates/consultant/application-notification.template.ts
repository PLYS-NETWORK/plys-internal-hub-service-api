import * as ejs from 'ejs';
import * as path from 'path';

export interface IConsultantApplicationNotificationTemplateOptions {
  /** Consultant's full name. */
  readonly recipientName: string;
  readonly projectTitle: string;
  readonly consultantFullName: string;
  /** Translated skill names that matched. */
  readonly matchedSkills: string[];
  /** Formatted consultant address string. */
  readonly consultantAddress: string;
}

export async function buildConsultantApplicationNotificationEmail(
  options: IConsultantApplicationNotificationTemplateOptions,
): Promise<string> {
  const { recipientName, projectTitle, consultantFullName, matchedSkills, consultantAddress } =
    options;

  return ejs.renderFile(path.join(__dirname, 'application-notification.template.ejs'), {
    recipientName,
    projectTitle,
    consultantFullName,
    matchedSkills,
    consultantAddress,
    year: new Date().getFullYear(),
  });
}
