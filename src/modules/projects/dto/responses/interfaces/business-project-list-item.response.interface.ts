import { Currency, ProjectStatus } from '@database/enums';

export interface IBusinessProjectListItemResponse {
  /** UUID of the project. */
  id: string;
  /** Human-readable project title. */
  title: string;
  /** Current lifecycle status. */
  status: ProjectStatus;
  /** Timestamp when the project record was created. */
  created_at: Date;
  /** Timestamp when the project was published; `null` until publication. */
  published_at: Date | null;
  /** Timestamp when the project moved to an active/started state; `null` until then. */
  started_at: Date | null;
  /** Timestamp when the project was marked completed; `null` until completion. */
  completed_at: Date | null;
  /** Timestamp when the project was cancelled; `null` if not cancelled. */
  cancelled_at: Date | null;
  /** Total number of applications for the project across every status. */
  total_applications: number;
  /** Total number of tasks attached to the project. */
  total_tasks: number;
  /** Number of tasks whose `kanban_status` is `done`. */
  total_completed_tasks: number;
  /** Project cost as a fixed-point decimal string with two fractional digits. When a completed `PROJECT_PUBLISHED` transaction exists for this project the value is its `total_amount` (locked at publish time, includes commission for pre-paid). Otherwise it is the raw sum of task prices. */
  total_cost: string;
  /** ISO 4217 currency code for `total_cost`. Hard-coded to `USD` until the multi-currency story lands. */
  currency: Currency;
  /** Distinct applicant avatar URLs (one entry per consultant who applied). Empty array if no applicant has uploaded an avatar. */
  application_avatars: string[];
}
