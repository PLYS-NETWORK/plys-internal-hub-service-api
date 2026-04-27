import { IProjectActivityEventResponse } from './project-activity-event.response.interface';

export interface IProjectActivityFeedResponse {
  project_id: string;
  events: IProjectActivityEventResponse[];
  page: number;
  page_size: number;
  total_events: number;
  total_pages: number;
}
