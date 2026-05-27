import * as ejs from 'ejs';
import * as path from 'path';

export interface IAdminInviteTemplateOptions {
  /** URL the CTA button points to (env `INTERNAL_HUB_URL`). */
  readonly internalHubUrl: string;
  /** Optional email of the admin who issued the invite — surfaced in the copy. */
  readonly invitedByEmail?: string;
}

export async function buildAdminInviteEmail(options: IAdminInviteTemplateOptions): Promise<string> {
  const { internalHubUrl, invitedByEmail } = options;

  return ejs.renderFile(path.join(__dirname, 'admin-invite.template.ejs'), {
    internalHubUrl,
    invitedByEmail: invitedByEmail ?? null,
    year: new Date().getFullYear(),
  });
}
