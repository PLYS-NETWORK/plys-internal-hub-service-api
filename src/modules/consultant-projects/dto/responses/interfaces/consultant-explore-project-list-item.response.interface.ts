import { ProjectPaymentType } from '@database/enums';

export interface IConsultantExploreProjectListItemResponse {
  readonly id: string;
  readonly title: string;
  readonly company_name: string;
  readonly is_platform_partner: boolean;
  /** True when the caller has an ACTIVE membership on this project. */
  readonly is_joined: boolean;
  /** Capacity + caller-side eligibility flag for the discovery feed. */
  readonly is_available_to_apply: boolean;
  /** Integer 0–100 — share of the project's required skills the consultant has. */
  readonly match_rate: number;
  /** Null for PER_MONTH projects (the field is task-priced). */
  readonly avg_price_per_task: number | null;
  readonly payment_type: ProjectPaymentType;
  readonly total_members: number;
  readonly required_consultants: number;
  readonly published_at: Date | null;
}
