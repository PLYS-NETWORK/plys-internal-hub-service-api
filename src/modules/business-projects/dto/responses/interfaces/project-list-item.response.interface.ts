import { ProjectStatus } from '@database/enums';

export interface IProjectListItemResponse {
  id: string;
  title: string;
  status: ProjectStatus;
  created_at: Date;
  published_at: Date | null;
  required_consultants: number;
  total_tasks: number;
  total_active_members: number;
  total_pending_applications: number;
}
