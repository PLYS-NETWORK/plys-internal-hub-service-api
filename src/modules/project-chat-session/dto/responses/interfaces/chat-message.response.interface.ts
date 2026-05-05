import { ChatMessageRole } from '@database/enums';

export interface IChatMessageResponse {
  id: string;
  seq: number;
  role: ChatMessageRole;
  parts: unknown;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

// Cursor-paginated response for GET /chat-sessions/:id/messages.
// `next_cursor` is the `seq` to pass back as `before` for the next page;
// null when there are no older messages.
export interface IChatMessagePageResponse {
  messages: IChatMessageResponse[];
  next_cursor: number | null;
}
