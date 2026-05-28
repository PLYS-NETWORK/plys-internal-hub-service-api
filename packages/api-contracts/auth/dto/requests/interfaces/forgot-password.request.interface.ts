import { ActivePlatform } from '@plys/libraries/database/enums';

export interface IForgotPasswordRequest {
  readonly email: string;
  readonly activePlatform: ActivePlatform;
}
