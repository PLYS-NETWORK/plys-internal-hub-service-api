import { ProjectPaymentType } from '@database/enums';

export interface IConsultantProjectDetailResponse {
  id: string;
  title: string;
  company_name: string;
  introduction: Record<string, unknown> | null;
  is_available_to_apply: boolean;
  match_rate: number;
  payment_type: ProjectPaymentType;
  is_need_interview: boolean;
}
