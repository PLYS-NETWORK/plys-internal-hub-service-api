import { AbstractRepository } from '@common/repositories';
import { BusinessProfile } from '@database/entities';

export interface IBusinessProfileRepository extends AbstractRepository<BusinessProfile> {
  /**
   * Returns the business profile for the given user, or `null` when none exists.
   *
   * @param userId - UUID of the owning user.
   * @returns The matching BusinessProfile or null.
   */
  findByUserId(userId: string): Promise<BusinessProfile | null>;

  /**
   * Fetches a profile by id with a pessimistic write lock (`SELECT ... FOR UPDATE`).
   * Must be called from within an active transaction (via `UnitOfWork.withTransaction`),
   * otherwise the lock is released immediately on statement completion.
   *
   * @param id - UUID of the business profile to lock.
   * @returns The locked BusinessProfile, or null if it does not exist.
   */
  findByIdForUpdate(id: string): Promise<BusinessProfile | null>;
}
