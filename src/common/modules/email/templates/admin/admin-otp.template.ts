import * as ejs from 'ejs';
import * as path from 'path';

export interface IAdminOtpTemplateOptions {
  readonly otp: string;
  readonly expiryMinutes?: number;
}

export async function buildAdminOtpEmail(options: IAdminOtpTemplateOptions): Promise<string> {
  const { otp, expiryMinutes = 10 } = options;

  return ejs.renderFile(path.join(__dirname, 'admin-otp.template.ejs'), {
    otp,
    expiryMinutes,
    year: new Date().getFullYear(),
  });
}
