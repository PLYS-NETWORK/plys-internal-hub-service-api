import { ConsultantSkill } from '@database/entities';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

import { ConsultantSkillInputDto } from '../dto/requests';

/**
 * Contract for managing the skill set associated with a consultant profile.
 *
 * All write methods accept an explicit `IUnitOfWork` so they can participate
 * in the caller's transaction (e.g., during onboarding or profile update).
 */
export interface IConsultantSkillsService {
  /**
   * Returns all skills linked to the given consultant profile.
   *
   * When an explicit `uow` is provided the query is executed within that
   * transaction; otherwise the default unit-of-work is used. This allows the
   * method to be called both inside and outside of transactions safely.
   *
   * @param consultantId - UUID of the consultant profile.
   * @param uow          - Optional unit-of-work to enrol into an existing
   *                       transaction.
   * @returns An array of `ConsultantSkill` entities (empty if none exist).
   */
  findByConsultantId(consultantId: string, uow?: IUnitOfWork): Promise<ConsultantSkill[]>;

  /**
   * Inserts a set of skills for a consultant profile within the given
   * transaction.
   *
   * Returns an empty array immediately when `skills` is empty, avoiding an
   * unnecessary round-trip to the database.
   *
   * @param consultantId - UUID of the consultant profile.
   * @param skills       - List of skill input DTOs to create.
   * @param uow          - Active unit-of-work / transaction to enrol into.
   * @returns The saved `ConsultantSkill` entities.
   */
  createForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]>;

  /**
   * Replaces the entire skill set for a consultant profile within the given
   * transaction.
   *
   * Executes a hard delete of all existing skills followed by a bulk insert of
   * the new set. Both operations share the same transaction so the skill set
   * is never left in a partial state.
   *
   * @param consultantId - UUID of the consultant profile.
   * @param skills       - Replacement list of skill input DTOs.
   * @param uow          - Active unit-of-work / transaction to enrol into.
   * @returns The newly saved `ConsultantSkill` entities.
   */
  replaceForConsultant(
    consultantId: string,
    skills: ConsultantSkillInputDto[],
    uow: IUnitOfWork,
  ): Promise<ConsultantSkill[]>;
}
