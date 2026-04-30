import { ApplicationStatus } from '@database/enums';

export interface IApplicationListItemConsultant {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface IApplicationListItemResponse {
  id: string;
  consultant: IApplicationListItemConsultant;
  cover_letter: string | null;
  status: ApplicationStatus;
  applied_at: Date;
  reviewed_at: Date | null;
  /** (matching_skills / required_skills_count) × 100, rounded; 0 when project has 0 required skills. */
  matching_rate: number;
}
