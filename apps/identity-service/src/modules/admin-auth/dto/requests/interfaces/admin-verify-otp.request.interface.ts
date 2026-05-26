import { ActivePlatform } from '@plys/libraries/database/enums';

export interface IAdminVerifyOtpRequest {
  readonly email: string;
  readonly otp: string;
  readonly activePlatform: ActivePlatform.ADMIN_PLATFORM;
}
