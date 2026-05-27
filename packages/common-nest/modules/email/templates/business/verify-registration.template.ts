import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessVerifyRegistrationTemplateOptions {
  readonly userName: string;
  readonly verificationUrl: string;
  readonly expiryHours?: number;
}

export async function buildBusinessVerifyRegistrationEmail(
  options: IBusinessVerifyRegistrationTemplateOptions,
): Promise<string> {
  const { userName, verificationUrl, expiryHours = 24 } = options;

  return ejs.renderFile(path.join(__dirname, 'verify-registration.template.ejs'), {
    userName,
    verificationUrl,
    expiryHours,
    year: new Date().getFullYear(),
  });
}
