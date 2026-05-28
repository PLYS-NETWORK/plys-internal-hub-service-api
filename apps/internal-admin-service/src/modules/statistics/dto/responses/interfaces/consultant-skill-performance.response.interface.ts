import { ProficiencyLevel } from '@plys/libraries/database/enums';

export interface IConsultantSkillPerformanceItem {
  skill_id: string;
  /** i18n key from `skills.name` — FE translates. */
  skill_name: string;
  proficiency_level: ProficiencyLevel | null;
  /** Latest passing exam score (0–100) from `consultant_skills.rating`. */
  exam_score: string | null;
  /** Most recent passing-score timestamp. */
  last_certified_at: string | null;
  /** Number of skill exams in PASSED status for this (consultant, skill). */
  total_passed_exams: number;
  /**
   * Count of ACTIVE project memberships where the project requires this
   * skill. A project may require multiple skills — the same project counts
   * once per matching skill.
   */
  active_projects_count: number;
  /** Count of DONE tasks the caller has completed on projects requiring this skill. */
  tasks_completed_lifetime: number;
  /**
   * Sum of CREDIT_CLEARED earnings on tasks belonging to projects that
   * require this skill. Same multi-skill caveat as `active_projects_count`.
   */
  earnings_from_skill: string;
}

export interface IConsultantSkillPerformanceResponse {
  skills: IConsultantSkillPerformanceItem[];
  generated_at: string;
}
