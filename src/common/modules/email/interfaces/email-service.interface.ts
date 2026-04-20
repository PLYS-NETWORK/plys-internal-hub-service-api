import {
  IAiDetectedEmailOptions,
  IApplicationNotificationEmailOptions,
  IForgotPasswordOtpEmailOptions,
  IVerifyRegistrationEmailOptions,
  IWelcomeEmailOptions,
} from './email-send-options.interface';

export interface IEmailService {
  sendVerificationEmail(to: string, options: IVerifyRegistrationEmailOptions): Promise<void>;
  sendForgotPasswordOtpEmail(to: string, options: IForgotPasswordOtpEmailOptions): Promise<void>;
  sendWelcomeEmail(to: string, options: IWelcomeEmailOptions): Promise<void>;
  sendApplicationNotificationEmail(
    to: string,
    options: IApplicationNotificationEmailOptions,
  ): Promise<void>;
  sendAiDetectedEmail(to: string, options: IAiDetectedEmailOptions): Promise<void>;
}
