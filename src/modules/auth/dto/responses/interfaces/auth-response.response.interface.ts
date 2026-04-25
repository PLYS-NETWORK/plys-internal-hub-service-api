import { IUserResponse } from './user-response.response.interface';

export interface IAuthResponse {
  /** Short-lived JWT used to authenticate subsequent API requests. */
  readonly access_token: string;
  /** Long-lived token used to obtain a new `access_token` without re-login. */
  readonly refresh_token: string;
  /** Access token lifetime in seconds (e.g. 900 for 15 minutes). */
  readonly expires_in: number;
  /** Basic profile of the authenticated user embedded in the auth payload. */
  readonly user: IUserResponse;
}
