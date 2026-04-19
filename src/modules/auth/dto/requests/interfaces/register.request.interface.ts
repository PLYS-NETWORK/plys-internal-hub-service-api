import { ActivePlatform } from '@database/enums/active-platform.enum';

export interface IRegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly active_platform: ActivePlatform;
}
