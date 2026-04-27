export interface IApplicationsPerProjectItem {
  project_id: string;
  project_name: string;
  total_applications: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
}

export interface IApplicationsPerProjectResponse {
  projects: IApplicationsPerProjectItem[];
}
