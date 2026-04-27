export interface IProjectApplicationStatsResponse {
  project_id: string;
  total_applications: number;
  pending_count: number;
  accepted_count: number;
  rejected_count: number;
  withdrawn_count: number;
}
