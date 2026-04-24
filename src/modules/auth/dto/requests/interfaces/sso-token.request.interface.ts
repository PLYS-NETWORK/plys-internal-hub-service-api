import { ActivePlatform } from '@database/enums';

export interface ISsoTokenRequest {
  readonly id_token: string;
  readonly active_platform: ActivePlatform;
}
