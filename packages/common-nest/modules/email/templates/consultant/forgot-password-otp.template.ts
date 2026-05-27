import * as ejs from 'ejs';
import * as path from 'path';

export interface IConsultantForgotPasswordOtpTemplateOptions {
  readonly userName: string;
  readonly otp: string;
  readonly expiryMinutes?: number;
}

export async function buildConsultantForgotPasswordOtpEmail(
  options: IConsultantForgotPasswordOtpTemplateOptions,
): Promise<string> {
  const { userName, otp, expiryMinutes = 10 } = options;

  return ejs.renderFile(path.join(__dirname, 'forgot-password-otp.template.ejs'), {
    userName,
    otp,
    expiryMinutes,
    year: new Date().getFullYear(),
  });
}
