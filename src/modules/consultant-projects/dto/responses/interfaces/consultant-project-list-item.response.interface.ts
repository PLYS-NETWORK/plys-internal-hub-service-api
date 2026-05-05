import { ProjectPaymentType } from '@database/enums';

export interface IConsultantProjectListItemResponse {
  id: string;
  title: string;
  company_name: string;
  is_available_to_apply: boolean;
  /** Integer 0–100 — share of the project's required skills the consultant has. */
  match_rate: number;
  is_platform_partner: boolean;
  /** Null for PER_MONTH projects (the field is task-priced). */
  avg_price_per_task: number | null;
  payment_type: ProjectPaymentType;
}
