import { ProjectStatus } from '@database/enums';

import { IProjectInterviewQuestionResponse } from './project-interview-question.response.interface';
import { IProjectSkillResponse } from './project-skill.response.interface';
import { IProjectTaskResponse } from './project-task.response.interface';

export interface IBusinessProjectResponse {
  /** UUID of the project. */
  id: string;
  /** UUID of the business that owns this project. */
  business_id: string;
  /** Human-readable project title. */
  title: string;
  /** Optional rich-text introduction shown to consultants (TipTap/ProseMirror JSON document); `null` when not yet provided. */
  introduction: Record<string, unknown> | null;
  /** Current lifecycle status (e.g. `draft`, `public`, `completed`). */
  status: ProjectStatus;
  /** Total number of consultants the business wants to hire for this project. */
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
  /** Interview questions the business has set for applicants; empty array if none configured. */
  interview_questions: IProjectInterviewQuestionResponse[];
  /** Deliverable tasks attached to this project; empty array if none are defined. */
  tasks: IProjectTaskResponse[];
}
