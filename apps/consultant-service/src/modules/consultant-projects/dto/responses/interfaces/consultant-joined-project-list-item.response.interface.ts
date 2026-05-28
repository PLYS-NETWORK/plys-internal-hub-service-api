import { ProjectStatus } from '@plys/libraries/database/enums';

export interface IConsultantJoinedProjectListItemResponse {
  readonly id: string;
  readonly title: string;
  readonly code: string;
  readonly status: ProjectStatus;
  readonly started_at: Date | null;
  readonly company_name: string;
  /** Integer 0–100 — share of non-DRAFT tasks marked DONE across the whole project. */
  readonly completion_pct: number;
  /** Count of DONE tasks assigned to the caller in this project. */
  readonly completed_tasks_by_me: number;
}
