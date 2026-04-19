export interface ICreateProjectRequest {
  title: string;
  introduction?: string;
  required_consultants?: number;
  skills?: string[];
}
