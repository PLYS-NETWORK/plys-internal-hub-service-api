import { IUserResponse } from './user-response.response.interface';

export interface IAuthResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly user: IUserResponse;
}
