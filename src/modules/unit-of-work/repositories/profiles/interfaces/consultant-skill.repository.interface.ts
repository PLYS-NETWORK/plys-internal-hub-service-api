import { AbstractRepository } from '@common/repositories';
import { ConsultantSkill } from '@database/entities';
import { ProficiencyLevel } from '@database/enums';

/**
 * Consultant-skill row joined to the `skills` taxonomy. The `skill_name` here
 * is the i18n key (e.g. `skill_react`) stored on `skills.name` — the FE is
 * responsible for translating.
 */
export interface IConsultantSkillRow {
  consultant_id: string;
  skill_id: string;
  skill_name: string;
  proficiency_level: ProficiencyLevel | null;
  rating: string | null;
}

export interface IConsultantSkillRepository extends AbstractRepository<ConsultantSkill> {
  findByConsultantId(consultantId: string): Promise<ConsultantSkill[]>;

  /**
   * Bulk lookup for one or more consultants, joined to `skills` so the
   * caller can render `{ name, proficiency, rating }` without a second
   * round-trip. Used by the project-overview team block.
   * @returns Rows sorted by `consultant_id` then `skill_name` ASC.
   */
  findByConsultantIds(consultantIds: string[]): Promise<IConsultantSkillRow[]>;

  /**
   * Returns the consultant's skill rows with the `skill` relation eagerly
   * populated so callers can read `name` without a second round-trip. Used
   * by the consultant dashboard skill-performance endpoint.
   */
  findByConsultantIdWithSkill(consultantId: string): Promise<ConsultantSkill[]>;

  /**
   * Counts the consultant's skill rows grouped by `proficiency_level`.
   * Levels with zero matches are zero-filled. `null` proficiency rows are
   * excluded — they represent skills the consultant declared but hasn't
   * certified.
   */
  countByConsultantGroupedByProficiency(
    consultantId: string,
  ): Promise<Record<ProficiencyLevel, number>>;
}
