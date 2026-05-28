import { ActivePlatform } from '@plys/libraries/database/enums';

export interface ILoginRequest {
  readonly email: string;
  readonly password: string;
  readonly active_platform: ActivePlatform;
}
