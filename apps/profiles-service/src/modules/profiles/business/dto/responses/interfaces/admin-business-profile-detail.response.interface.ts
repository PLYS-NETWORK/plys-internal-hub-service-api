import { IBusinessProfileResponse } from './business-profile.response.interface';

/**
 * Detail shape returned by `GET /admin/business-profiles/:id`. Superset of
 * the user-scoped `IBusinessProfileResponse` plus three columns sourced from
 * the joined `users` row: the auth account's `email`, the platform
 * registration timestamp (`register_date` ← `users.created_at`), and the
 * latest login timestamp (`last_login` ← `users.last_login_at`, `null` until
 * the user first logs in).
 *
 * Note: `created_at` on the base interface is the **profile**'s creation
 * timestamp; `register_date` is the **user account**'s creation timestamp.
 * They diverge whenever a user signs up before completing business onboarding.
 */
export interface IAdminBusinessProfileDetailResponse extends IBusinessProfileResponse {
  readonly email: string;
  readonly register_date: Date;
  readonly last_login: Date | null;
}
