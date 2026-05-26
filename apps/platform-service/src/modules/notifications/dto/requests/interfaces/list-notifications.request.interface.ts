export interface IListNotificationsRequest {
  /**
   * Opaque base64 cursor encoding `{ created_at, id }`. Omit on the first page.
   * Pass back the `next_cursor` returned by the server to fetch the next page.
   */
  readonly cursor?: string;
  /** Page size; server caps at 50. */
  readonly take: number;
  /** When true, restrict results to unread notifications only. */
  readonly unread?: boolean;
}
