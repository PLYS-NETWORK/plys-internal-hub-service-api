/**
 * Item shape returned by `GET /admin/business-profiles`. snake_case is the
 * JSON contract — the service maps from the `BusinessProfile` + joined `User`
 * entity into this plain shape before `plainToInstance`.
 *
 * `register_date` and `last_login` come from the linked `users` row
 * (`users.created_at`, `users.last_login_at`), not the business profile.
 */
export interface IAdminBusinessProfileListItemResponse {
  readonly id: string;
  readonly user_id: string;
  readonly company_name: string;
  readonly email: string;
  readonly phone_number: string | null;
  readonly address_line: string | null;
  readonly city: string | null;
  readonly state_province: string | null;
  readonly postal_code: string | null;
  readonly country_code: string | null;
  readonly is_partner_platform: boolean;
  readonly allow_payment_credit: boolean;
  readonly is_verified: boolean;
  readonly register_date: Date;
  readonly last_login: Date | null;
}
