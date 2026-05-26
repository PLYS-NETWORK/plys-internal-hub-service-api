/**
 * Item shape returned by `POST /admin/allowed-emails`,
 * `GET /admin/allowed-emails` (inside `data[]`), and used for `:id` reads.
 *
 * `last_login` is sourced from the linked `users.last_login_at` row matched
 * by `LOWER(users.email) = LOWER(admin_allowed_emails.email)` and
 * `users.platform = ADMIN_PLATFORM`. It stays `null` until the invited
 * admin first signs in.
 */
export interface IAdminAllowedEmailResponse {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly is_active: boolean;
  readonly created_at: Date;
  readonly last_login: Date | null;
}
