export interface ICreateBoardCommentRequest {
  comment: Record<string, unknown>;
  fileIds?: string[];
}
