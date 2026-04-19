import { IForgotPasswordOtpEmailOptions } from './email-send-options.interface';
import { IVerifyRegistrationEmailOptions } from './email-send-options.interface';
import { IWelcomeEmailOptions } from './email-send-options.interface';

export interface IEmailService {
  sendVerificationEmail(to: string, options: IVerifyRegistrationEmailOptions): Promise<void>;
  sendForgotPasswordOtpEmail(to: string, options: IForgotPasswordOtpEmailOptions): Promise<void>;
  sendWelcomeEmail(to: string, options: IWelcomeEmailOptions): Promise<void>;
}
