import * as ejs from 'ejs';
import * as path from 'path';

export interface IVerifyRegistrationTemplateOptions {
  readonly userName: string;
  readonly verificationUrl: string;
  readonly expiryHours?: number;
}

/**
 * Renders the account-verification email using the EJS template.
 * __dirname resolves to the compiled output directory, where the
 * .ejs file is copied by the nest-cli assets configuration.
 */
export async function buildVerifyRegistrationEmail(
  options: IVerifyRegistrationTemplateOptions,
): Promise<string> {
  const { userName, verificationUrl, expiryHours = 24 } = options;

  return ejs.renderFile(path.join(__dirname, 'verify-registration.template.ejs'), {
    userName,
    verificationUrl,
    expiryHours,
    year: new Date().getFullYear(),
  });
}
