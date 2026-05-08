import { ActivePlatform } from '@database/enums';

export interface IAdminRequestOtpRequest {
  readonly email: string;
  readonly activePlatform: ActivePlatform.ADMIN_PLATFORM;
}
