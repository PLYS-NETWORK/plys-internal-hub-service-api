import { ProjectStatus } from '@database/enums';

import { IProjectInterviewQuestionResponse } from './project-interview-question.response.interface';
import { IProjectSkillResponse } from './project-skill.response.interface';

export interface IBusinessProjectListItemResponse {
  /** UUID of the project. */
  id: string;
  /** UUID of the business that owns this project. */
  business_id: string;
  /** Human-readable project title. */
  title: string;
  /** Optional rich-text introduction (TipTap/ProseMirror JSON document); `null` when not yet provided. */
  introduction: Record<string, unknown> | null;
  /** Current lifecycle status. */
  status: ProjectStatus;
  /** Total number of consultants the business wants to hire. */
  required_consultants: number;
  /** Timestamp when the project was published; `null` until publication. */
  published_at: Date | null;
  /** Timestamp when the project moved to an active/started state; `null` until then. */
  started_at: Date | null;
  /** Timestamp when the project was marked completed; `null` until completion. */
  completed_at: Date | null;
  /** Timestamp when the project was cancelled; `null` if not cancelled. */
  cancelled_at: Date | null;
  /** Timestamp when the project record was created. */
  created_at: Date;
  /** Skills required for this project; empty array if none are defined. */
  skills: IProjectSkillResponse[];
  /** Interview questions configured for applicants; empty array if none configured. */
  interview_questions: IProjectInterviewQuestionResponse[];
  /** Total number of tasks attached to the project. */
  total_tasks: number;
  /** Number of tasks whose `kanban_status` is `done`. */
  total_completed_tasks: number;
  /** Sum of task prices grossed up by the business commission rate (publish-style: `sum(price) × (1 + commission_rate)`). For credit-billed businesses commission is 0, so this equals the raw sum of prices. Returned as a fixed-point decimal string with two fractional digits. */
  total_costs: string;
  /** Number of consultants currently active on the project (excludes removed/left). */
  total_members: number;
  /** Total number of applications for the project across every status (pending + accepted + rejected + withdrawn). */
  total_applications: number;
}
