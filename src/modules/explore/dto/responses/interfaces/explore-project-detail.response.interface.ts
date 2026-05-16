import { ProjectStatus } from '@database/enums';

import { IExploreSkillResponse } from './explore-skill.response.interface';

export interface IExploreProjectDetailResponse {
  readonly id: string;
  readonly title: string;
  readonly company_name: string;
  readonly company_logo_url: string | null;
  readonly is_partner_platform: boolean;
  readonly published_at: Date | null;
  readonly required_consultants: number;
  readonly introduction: Record<string, unknown> | null;
  readonly required_skills: IExploreSkillResponse[];
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly status: ProjectStatus;
}
