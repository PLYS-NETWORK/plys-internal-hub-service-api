import { ActivePlatform } from '@database/enums/active-platform.enum';

export interface IRegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly active_platform: ActivePlatform;
  readonly company_name?: string;
  readonly full_name?: string;
}
