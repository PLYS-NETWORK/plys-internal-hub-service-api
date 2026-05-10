import { AbstractRepository } from '@common/repositories';
import { ConsultantSkillScore } from '@database/entities';

export interface IConsultantSkillScoreRepository extends AbstractRepository<ConsultantSkillScore> {
  /**
   * Returns all skill scores for a consultant, used for project matching.
   *
   * @param consultantId - The consultant profile UUID.
   * @returns Array of ConsultantSkillScore rows.
   */
  findByConsultantId(consultantId: string): Promise<ConsultantSkillScore[]>;
}
