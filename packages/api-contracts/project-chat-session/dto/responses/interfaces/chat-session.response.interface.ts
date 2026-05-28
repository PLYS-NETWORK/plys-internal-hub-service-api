import { ChatSessionMode, ChatSessionStatus } from '@plys/libraries/database/enums';

// Lightweight session metadata shown in the FE picker. Excludes `draft` (can
// be tens of KB) and `messages` (live in chat_message rows).
export interface IChatSessionListItemResponse {
  id: string;
  mode: ChatSessionMode;
  stage: string | null;
  title: string;
  status: ChatSessionStatus;
  message_count: number;
  implemented_at: Date | null;
  created_task_ids: string[] | null;
  created_at: Date;
  updated_at: Date;
}

// Adds the `draft` blob the FE needs when resuming an active session.
export interface IChatSessionMetaResponse extends IChatSessionListItemResponse {
  project_id: string;
  user_id: string;
  draft: Record<string, unknown>;
}

// Echo from PATCH /chat-sessions/:id — minimal so the FE can update its
// optimistic UI without re-reading the meta payload.
export interface IPatchSessionResponse {
  id: string;
  message_count: number;
  updated_at: Date;
}
