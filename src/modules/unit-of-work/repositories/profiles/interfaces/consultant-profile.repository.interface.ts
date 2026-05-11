import { AbstractRepository } from '@common/repositories';
import { ConsultantProfile } from '@database/entities';

export interface IConsultantProfileRepository extends AbstractRepository<ConsultantProfile> {
  findByUserId(userId: string): Promise<ConsultantProfile | null>;
  /**
   * Returns the userIds of all consultant profiles that have at least one skill
   * matching the provided skill IDs. Used for project skill-match fan-out.
   * @param skillIds Array of skill UUIDs to match against.
   * @param offset Pagination offset (for batched processing).
   * @param limit  Batch size.
   * @returns Array of userId strings.
   */
  findUserIdsBySkillIds(skillIds: string[], offset: number, limit: number): Promise<string[]>;
}
