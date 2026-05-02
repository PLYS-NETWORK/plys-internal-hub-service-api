import { ProjectPaymentType, ProjectStatus } from '@database/enums';

export interface IProjectSummaryResponse {
  id: string;
  code: string;
  title: string;
  introduction: Record<string, unknown> | null;
  status: ProjectStatus;
  payment_type: ProjectPaymentType;
  required_consultants: number;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
