import { ProjectPaymentType, ProjectStatus } from '@plys/libraries/database/enums';

import { IConsultantExploreSkillResponse } from './consultant-explore-skill.response.interface';

export interface IConsultantExploreProjectDetailResponse {
  readonly id: string;
  readonly title: string;
  readonly company_name: string;
  readonly is_platform_partner: boolean;
  readonly is_joined: boolean;
  readonly is_available_to_apply: boolean;
  readonly match_rate: number;
  readonly avg_price_per_task: number | null;
  readonly payment_type: ProjectPaymentType;
  readonly total_members: number;
  readonly required_consultants: number;
  readonly published_at: Date | null;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly status: ProjectStatus;
  readonly introduction: Record<string, unknown> | null;
  readonly required_skills: IConsultantExploreSkillResponse[];
}
