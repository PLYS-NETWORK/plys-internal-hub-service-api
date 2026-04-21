export interface ITaskCommentResponse {
  readonly id: string;
  readonly task_id: string;
  readonly author_id: string;
  readonly body: string;
  readonly is_edited: boolean;
  readonly edited_at: Date | null;
  readonly created_at: Date;
}
