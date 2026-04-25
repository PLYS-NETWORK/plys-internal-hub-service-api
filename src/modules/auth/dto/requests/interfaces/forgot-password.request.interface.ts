import { ActivePlatform } from '@database/enums';

export interface IForgotPasswordRequest {
  readonly email: string;
  readonly activePlatform: ActivePlatform;
}
