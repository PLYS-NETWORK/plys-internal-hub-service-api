export interface IPendingApplicationItem {
  application_id: string;
  project_id: string;
  project_name: string;
  consultant_id: string;
  consultant_name: string;
  applied_at: Date;
  /** True when the consultant answered every required interview question on this project. */
  has_answered_questions: boolean;
}

export interface IPendingApplicationsResponse {
  total_pending: number;
  items: IPendingApplicationItem[];
  page: number;
  page_size: number;
  total_pages: number;
}
