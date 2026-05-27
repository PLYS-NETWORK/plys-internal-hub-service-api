import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { BusinessProfile } from '@plys/libraries/database/entities';
import { ActivePlatform } from '@plys/libraries/database/enums';

/**
 * Parameters for {@link IBusinessProfileRepository.existsTaxIdConflict}.
 */
export interface IExistsTaxIdConflictParams {
  /** Tax identifier to check (case-sensitive — onboarding accepts mixed case). */
  readonly taxId: string;
  /** ISO 3166-1 alpha-2 country code paired with the tax_id. */
  readonly countryCode: string;
  /** Platform of the caller — uniqueness is scoped per-platform. */
  readonly platform: ActivePlatform;
  /** When set, this user's own profile is excluded (PATCH /me re-checks). */
  readonly excludeUserId?: string;
}

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

  /**
   * Returns the profile only when BOTH the id and the owning user match. Used
   * everywhere the business id arrives from a JWT claim — defends against a
   * tampered claim trying to read a different tenant's profile by always
   * binding the lookup to the authenticated userId.
   *
   * @param userId - UUID of the owning user (from RequestContextService).
   * @param businessId - BusinessProfile id (from RequestContextService.businessId / JWT).
   * @returns The matching BusinessProfile, or null when either id is wrong.
   */
  findOneByUserAndId(userId: string, businessId: string): Promise<BusinessProfile | null>;

  /**
   * Checks whether another active account on the same platform already owns a
   * business profile with this `(tax_id, country_code)` pair. The query joins
   * `business_profiles` to `users` and filters by `users.platform`,
   * `users.is_active = true`, and `users.banned_at IS NULL` so de-activated /
   * banned accounts never block a new onboarding.
   *
   * @param params - Tax id + country code to check, plus the caller's
   *                 platform and an optional `excludeUserId` (skip the
   *                 caller's own profile during a PATCH).
   * @returns `true` when a conflicting active profile exists, `false` otherwise.
   */
  existsTaxIdConflict(params: IExistsTaxIdConflictParams): Promise<boolean>;
}
