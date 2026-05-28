export interface IChangePasswordRequest {
  readonly current_password: string;
  readonly new_password: string;
}
