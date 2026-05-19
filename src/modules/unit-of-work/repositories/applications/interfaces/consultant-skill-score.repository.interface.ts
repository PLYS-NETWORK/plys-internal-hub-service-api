import { AbstractRepository } from '@common/repositories';
import { ConsultantSkillScore } from '@database/entities';

export interface IConsultantSkillScoreRepository extends AbstractRepository<ConsultantSkillScore> {
  /**
   * Returns the most recent `calculated_at` per `skill_id` for the
   * consultant's passing-score history. Skills the consultant has never
   * passed an exam for are absent from the map. Used for the consultant
   * dashboard skill-performance `last_certified_at` column.
   */
  findLatestPassedByConsultantGroupedBySkill(consultantId: string): Promise<Map<string, Date>>;
}
