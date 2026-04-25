export interface IConsultantSkillResponse {
  /** UUID of the skill in the global skills taxonomy. */
  readonly skill_id: string;
  /** Self-reported proficiency level (e.g. `"beginner"`, `"intermediate"`, `"expert"`). */
  readonly proficiency_level: string;
  /** Number of years the consultant has actively used this skill; `null` when not provided. */
  readonly years_with_skill: number | null;
}
