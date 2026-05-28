import { ProjectStatus } from '@plys/libraries/database/enums';

import { IConsultantExploreSkillResponse } from './consultant-explore-skill.response.interface';

export interface IConsultantJoinedProjectDetailResponse {
  readonly id: string;
  readonly title: string;
  readonly code: string;
  readonly status: ProjectStatus;
  readonly introduction: Record<string, unknown> | null;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly company_name: string;
  readonly required_skills: IConsultantExploreSkillResponse[];
  readonly total_members: number;
  readonly total_tasks: number;
  readonly completed_tasks_overall: number;
  readonly completion_pct: number;
  readonly completed_tasks_by_me: number;
  readonly in_progress_by_me: number;
}
