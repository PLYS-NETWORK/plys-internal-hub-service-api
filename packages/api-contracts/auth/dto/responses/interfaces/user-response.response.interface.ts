export interface IUserResponse {
  /** UUID of the user record. */
  readonly id: string;
  /** Login email address of the user. */
  readonly email: string;
  /** `true` once the user has clicked the verification link sent on registration. */
  readonly is_email_verified: boolean;
  /** `false` when the account has been suspended; `true` for normal accounts. */
  readonly is_active: boolean;
}
