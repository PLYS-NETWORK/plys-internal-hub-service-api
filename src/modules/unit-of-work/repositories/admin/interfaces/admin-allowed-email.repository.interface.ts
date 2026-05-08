import { AbstractRepository } from '@common/repositories';
import { AdminAllowedEmail } from '@database/entities';

export interface IAdminAllowedEmailRepository extends AbstractRepository<AdminAllowedEmail> {
  /**
   * Finds an active whitelisted admin email by address (case-insensitive).
   *
   * @param email - The email address to look up.
   * @returns The matching `AdminAllowedEmail` row, or `null` if not found / inactive.
   */
  findActiveByEmail(email: string): Promise<AdminAllowedEmail | null>;
}
