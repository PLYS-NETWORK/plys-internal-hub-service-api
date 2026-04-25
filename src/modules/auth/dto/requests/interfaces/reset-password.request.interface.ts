import { ActivePlatform } from '@database/enums';

export interface IResetPasswordRequest {
  readonly email: string;
  readonly activePlatform: ActivePlatform;
  readonly otp: string;
  readonly newPassword: string;
}
