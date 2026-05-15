import { UpdateConsultantProfileDto } from '../dto/requests';
import { ConsultantProfileResponseDto } from '../dto/responses';

/**
 * Contract for consultant profile operations.
 *
 * Caller identity is resolved internally via `RequestContextService` on every
 * user-scoped method — no `userId` is accepted as a parameter.
 */
export interface IConsultantProfilesService {
  /**
   * Returns the authenticated consultant's own profile, including all
   * associated skills.
   *
   * Skills are fetched in a separate query (not a JOIN) to avoid multiplying
   * the profile row.
   *
   * @returns The caller's `ConsultantProfileResponseDto` with skills embedded.
   * @throws TranslatableException (404) — profile not found for the caller.
   */
  getProfile(): Promise<ConsultantProfileResponseDto>;

  /**
   * Applies a partial update to the authenticated consultant's profile.
   *
   * When `skills` is provided the entire skill set is replaced inside the
   * same transaction (delete-then-insert). Omitting `skills` leaves the
   * existing skills untouched.
   *
   * @param dto - Fields to update; all properties are optional.
   * @returns The updated `ConsultantProfileResponseDto`.
   * @throws TranslatableException (404) — profile not found for the caller.
   */
  updateProfile(dto: UpdateConsultantProfileDto): Promise<ConsultantProfileResponseDto>;
}
