export interface ICreateDraftTaskRequest {
  title: string;
  description?: Record<string, unknown> | null;
  price: string;
}
