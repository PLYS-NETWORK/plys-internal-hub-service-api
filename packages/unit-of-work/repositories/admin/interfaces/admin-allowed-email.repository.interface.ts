import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { AdminAllowedEmail } from '@plys/libraries/database/entities';

export interface IAdminAllowedEmailRepository extends AbstractRepository<AdminAllowedEmail> {
  /**
   * Finds an active whitelisted admin email by address (case-insensitive).
   *
   * @param email - The email address to look up.
   * @returns The matching `AdminAllowedEmail` row, or `null` if not found / inactive.
   */
  findActiveByEmail(email: string): Promise<AdminAllowedEmail | null>;

  /**
   * Finds an admin allow-list entry by email address (case-insensitive),
   * regardless of `is_active`. Used by the invite flow to distinguish
   * "already on list and active" from "previously revoked" and surface
   * distinct error codes for each branch.
   *
   * @param email - The email address to look up.
   * @returns The matching `AdminAllowedEmail` row, or `null` if no row exists.
   */
  findByEmail(email: string): Promise<AdminAllowedEmail | null>;
}
