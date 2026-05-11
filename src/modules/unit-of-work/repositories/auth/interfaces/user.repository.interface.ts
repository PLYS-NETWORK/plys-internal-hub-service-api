import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';
import { ActivePlatform } from '@database/enums';

export interface IUserRepository extends AbstractRepository<User> {
  findUserByEmailAndPlatform(email: string, platform: ActivePlatform): Promise<User | null>;
  /**
   * Returns the IDs of all users with role ADMIN_PLATFORM whose account is active.
   * Used by the notification event handler to fan-out admin broadcast notifications.
   * @returns Array of userId strings (empty if no active admins).
   */
  findActiveAdminUserIds(): Promise<string[]>;
}
