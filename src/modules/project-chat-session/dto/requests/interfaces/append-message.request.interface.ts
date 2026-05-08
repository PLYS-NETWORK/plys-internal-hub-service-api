import { ChatMessageRole } from '@database/enums';

// Mirrors the Vercel AI SDK UIMessage shape on the wire. The BE persists
// `role`/`parts`/`metadata` verbatim so the FE can round-trip without lossy
// transforms.
export interface IAppendMessageRequest {
  role: ChatMessageRole;
  parts: unknown;
  metadata?: Record<string, unknown> | null;
}

export interface IPatchSessionRequest {
  appendMessages?: IAppendMessageRequest[];
  draft?: Record<string, unknown>;
  stage?: string | null;
}
