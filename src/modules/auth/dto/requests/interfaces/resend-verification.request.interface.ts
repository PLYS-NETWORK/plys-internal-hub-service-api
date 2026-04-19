import { ActivePlatform } from '@database/enums/active-platform.enum';

export interface IResendVerificationRequest {
  readonly email: string;
  readonly active_platform: ActivePlatform;
}
