import { IConsultantProfileResponse } from './consultant-profile.response.interface';

/**
 * Detail shape returned by `GET /admin/consultant-profiles/:id`. Superset of
 * the user-scoped `IConsultantProfileResponse` plus columns the consultant
 * never sees on their own `/me` payload but admins need: `cv_url`,
 * `stripe_connect_account_id`, `has_notification_priority`, `avg_rating`, and
 * the joined auth account's `email`, `register_date`, `last_login`.
 *
 * Note: `created_at` on the base interface is the **profile**'s creation
 * timestamp; `register_date` is the **user account**'s creation timestamp.
 * They diverge whenever a user signs up before completing consultant
 * onboarding.
 */
export interface IAdminConsultantProfileDetailResponse extends IConsultantProfileResponse {
  readonly cv_url: string | null;
  readonly stripe_connect_account_id: string | null;
  readonly has_notification_priority: boolean;
  readonly avg_rating: number | null;
  readonly email: string;
  readonly register_date: Date;
  readonly last_login: Date | null;
}
