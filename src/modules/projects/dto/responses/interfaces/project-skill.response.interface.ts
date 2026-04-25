export interface IProjectSkillResponse {
  /** UUID of the skill record in the global skills taxonomy. */
  skill_id: string;
  /** Human-readable display name of the skill (locale-specific label from the taxonomy). */
  skill_name: string;
}
