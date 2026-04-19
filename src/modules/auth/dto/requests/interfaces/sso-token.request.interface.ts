import { ActivePlatform } from '@database/enums/active-platform.enum';

export interface ISsoTokenRequest {
  readonly id_token: string;
  readonly active_platform: ActivePlatform;
}
