import { ActivePlatform } from '@database/enums/active-platform.enum';

import {
  IAiDetectedEmailOptions,
  IApplicationStatusEmailOptions,
  IBusinessApplicationNotificationEmailOptions,
  IConsultantApplicationNotificationEmailOptions,
  IForgotPasswordOtpEmailOptions,
  IVerifyRegistrationEmailOptions,
  IWelcomeEmailOptions,
} from './email-send-options.interface';

export interface IEmailService {
  sendVerificationEmail(
    to: string,
    options: IVerifyRegistrationEmailOptions,
    platform: ActivePlatform,
  ): Promise<void>;
  sendForgotPasswordOtpEmail(
    to: string,
    options: IForgotPasswordOtpEmailOptions,
    platform: ActivePlatform,
  ): Promise<void>;
  sendWelcomeEmail(
    to: string,
    options: IWelcomeEmailOptions,
    platform: ActivePlatform,
  ): Promise<void>;
  sendApplicationNotificationToBusinessEmail(
    to: string,
    options: IBusinessApplicationNotificationEmailOptions,
  ): Promise<void>;
  sendApplicationNotificationToConsultantEmail(
    to: string,
    options: IConsultantApplicationNotificationEmailOptions,
  ): Promise<void>;
  sendAiDetectedEmail(to: string, options: IAiDetectedEmailOptions): Promise<void>;
  sendApplicationStatusEmail(to: string, options: IApplicationStatusEmailOptions): Promise<void>;
}
