import { ProjectPaymentType, ProjectStatus } from '@plys/libraries/database/enums';

export interface IProjectListItemResponse {
  id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  payment_type: ProjectPaymentType;
  created_at: Date;
  published_at: Date | null;
  required_consultants: number;
  total_tasks: number;
  total_completed_tasks: number;
  total_active_members: number;
}
