import { UserRole } from '@database/enums';

/**
 * camelCase TS-internal shape of the admin allow-list invite body.
 * `role` is restricted to the two admin-platform roles; defaults to ADMIN_PLATFORM
 * when omitted to preserve backwards compatibility with existing invites.
 */
export interface IInviteAdminEmailRequest {
  readonly email: string;
  readonly role?: UserRole.ADMIN_PLATFORM | UserRole.TASK_REVIEWER;
}
