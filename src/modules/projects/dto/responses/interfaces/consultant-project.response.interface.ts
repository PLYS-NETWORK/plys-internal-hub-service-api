import { ProjectStatus } from '@database/enums/project-status.enum';

import { IProjectInterviewQuestionResponse } from './project-interview-question.response.interface';
import { IProjectSkillResponse } from './project-skill.response.interface';

export interface ICompanyAddressResponse {
  readonly address_line: string | null;
  readonly city: string | null;
  readonly state_province: string | null;
  readonly postal_code: string | null;
  readonly country_code: string | null;
}

export interface IConsultantProjectResponse {
  id: string;
  business_id: string;
  title: string;
  introduction: string | null;
  status: ProjectStatus;
  required_consultants: number;
  published_at: Date | null;
  started_at: Date | null;
  cancelled_at: Date | null;
  payment_type: 'per_task' | 'monthly';
  company_name: string;
  company_address: ICompanyAddressResponse;
  is_partner_platform: boolean;
  skills: IProjectSkillResponse[];
  interview_questions: IProjectInterviewQuestionResponse[];
}
