import { ActivePlatform } from '@database/enums';

export interface IResendVerificationRequest {
  readonly email: string;
  readonly active_platform: ActivePlatform;
}
