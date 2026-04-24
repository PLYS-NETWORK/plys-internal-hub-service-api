import { ActivePlatform } from '@database/enums';

export interface ILoginRequest {
  readonly email: string;
  readonly password: string;
  readonly active_platform: ActivePlatform;
}
