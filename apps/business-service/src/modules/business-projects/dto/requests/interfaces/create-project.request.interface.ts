export interface ICreateProjectRequest {
  code: string;
  title: string;
  introduction?: Record<string, unknown> | null;
}
