/**
 * Item shape returned by `GET /admin/consultant-profiles`. snake_case is the
 * JSON contract — the service maps from the `ConsultantProfile` + joined
 * `User` entity into this plain shape before `plainToInstance`.
 *
 * The list is hard-filtered to onboarding-approved consultants
 * (`is_verified = true`), so the flag is always `true` in this response — it is
 * kept on the shape for parity with the detail view and so future filter
 * relaxations don't require a payload migration.
 *
 * `register_date` and `last_login` come from the linked `users` row
 * (`users.created_at`, `users.last_login_at`), not the consultant profile.
 */
export interface IAdminConsultantProfileListItemResponse {
  readonly id: string;
  readonly user_id: string;
  readonly full_name: string;
  readonly avatar_url: string | null;
  readonly email: string;
  readonly phone_number: string | null;
  readonly city: string | null;
  readonly country_code: string | null;
  readonly years_of_experience: number | null;
  readonly is_verified: boolean;
  readonly has_notification_priority: boolean;
  readonly avg_rating: number | null;
  readonly register_date: Date;
  readonly last_login: Date | null;
}
