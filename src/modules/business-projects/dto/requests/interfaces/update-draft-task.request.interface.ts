export interface IUpdateDraftTaskRequest {
  title?: string;
  description?: Record<string, unknown> | null;
  price?: string;
}
