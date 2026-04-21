import * as ejs from 'ejs';
import * as path from 'path';

export interface IBusinessForgotPasswordOtpTemplateOptions {
  readonly userName: string;
  readonly otp: string;
  readonly expiryMinutes?: number;
}

export async function buildBusinessForgotPasswordOtpEmail(
  options: IBusinessForgotPasswordOtpTemplateOptions,
): Promise<string> {
  const { userName, otp, expiryMinutes = 10 } = options;

  return ejs.renderFile(path.join(__dirname, 'forgot-password-otp.template.ejs'), {
    userName,
    otp,
    expiryMinutes,
    year: new Date().getFullYear(),
  });
}
