import { ProjectStatus } from '@database/enums/project-status.enum';

import { IProjectSkillResponse } from './project-skill.response.interface';

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
  skills: IProjectSkillResponse[];
}
