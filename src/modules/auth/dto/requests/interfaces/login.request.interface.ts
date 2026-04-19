import { ActivePlatform } from '@database/enums/active-platform.enum';

export interface ILoginRequest {
  readonly email: string;
  readonly password: string;
  readonly active_platform: ActivePlatform;
}
