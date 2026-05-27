export interface IConsultantSkillResponse {
  /** UUID of the skill in the global skills taxonomy. */
  readonly skill_id: string;
  /** System-assigned proficiency from the latest passed skill exam; null if not yet passed. */
  readonly proficiency_level: string | null;
  /** 0–100 % score from the latest passed skill exam; null if not yet passed. */
  readonly rating: string | null;
}
