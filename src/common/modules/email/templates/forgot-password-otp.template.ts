import * as ejs from 'ejs';
import * as path from 'path';

export interface IForgotPasswordOtpTemplateOptions {
  readonly userName: string;
  readonly otp: string;
  readonly expiryMinutes?: number;
}

/**
 * Renders the forgot-password OTP email using the EJS template.
 * The OTP digit-splitting logic lives in the .ejs file itself.
 * __dirname resolves to the compiled output directory, where the
 * .ejs file is copied by the nest-cli assets configuration.
 */
export async function buildForgotPasswordOtpEmail(
  options: IForgotPasswordOtpTemplateOptions,
): Promise<string> {
  const { userName, otp, expiryMinutes = 10 } = options;

  return ejs.renderFile(path.join(__dirname, 'forgot-password-otp.template.ejs'), {
    userName,
    otp,
    expiryMinutes,
    year: new Date().getFullYear(),
  });
}
