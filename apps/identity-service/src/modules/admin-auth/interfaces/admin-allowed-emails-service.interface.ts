import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';

import { InviteAdminEmailDto } from '../dto/requests/invite-admin-email.dto';
import { ListAdminAllowedEmailsDto } from '../dto/requests/list-admin-allowed-emails.dto';
import { AdminAllowedEmailResponseDto } from '../dto/responses/admin-allowed-email-response.dto';

/**
 * Contract for platform-admin operations on the `admin_allowed_emails`
 * table. Distinct from `IAdminAuthService` (OTP request / verify) — this
 * service governs **who is allowed onto the hub**, not the login itself.
 *
 * Every method assumes the caller is authorised by the controller's
 * class-level `@Roles(UserRole.ADMIN_PLATFORM)`.
 */
export interface IAdminAllowedEmailsService {
  /**
   * Adds a new email to the admin allow-list and emails the recipient a
   * link to the Admin Hub. Within a single DB transaction the row is
   * inserted and the invitation email is sent; an email-provider failure
   * rolls back the insert so the admin can retry without hitting an
   * "already exists" error from a poisoned half-created row.
   *
   * @param dto Body containing the email address to invite.
   * @returns The newly created allow-list row (`is_active = true`,
   *          `last_login = null`).
   * @throws TranslatableException(ADMIN_ALLOWED_EMAIL_ALREADY_EXISTS, 409)
   *         if the email is already present and active.
   * @throws TranslatableException(ADMIN_ALLOWED_EMAIL_REVOKED, 409) if the
   *         email is present but `is_active = false` — the admin should
   *         re-activate via `setActive` instead of inviting again.
   */
  invite(dto: InviteAdminEmailDto): Promise<AdminAllowedEmailResponseDto>;

  /**
   * Returns a paginated, optionally-filtered slice of the allow-list. The
   * service joins the `users` row by lower-cased email + admin platform so
   * each item carries a `last_login` timestamp (or `null` if the invited
   * admin has never signed in).
   *
   * @param filters Pagination + optional `is_active` / `keywords` filters.
   * @returns `PageDto` of allow-list items wrapped in standard pagination
   *          metadata. Empty `data` when no rows match.
   */
  list(filters: ListAdminAllowedEmailsDto): Promise<PageDto<AdminAllowedEmailResponseDto>>;

  /**
   * Bidirectional setter for `admin_allowed_emails.is_active`.
   *
   * Idempotent — re-applying the same value resaves the row but produces
   * no observable diff.
   *
   * @param id    Allow-list row UUID.
   * @param value New flag value.
   * @throws TranslatableException(ADMIN_ALLOWED_EMAIL_NOT_FOUND, 404) if
   *         the row is missing.
   * @throws TranslatableException(ADMIN_ALLOWED_EMAIL_CANNOT_REVOKE_SELF, 403)
   *         if the target row's email matches the requester's email
   *         (case-insensitive) — admins may not toggle their own access.
   */
  setActive(id: string, value: boolean): Promise<void>;
}
