// Roles emitted by the Vercel AI SDK / chat UI. `tool` covers tool-call
// responses; `system` covers prompt scaffolding the FE may persist for replay.
// Distinct from AiMessageRole (used by the older ai_session_messages table)
// so the chat surface can evolve independently.
export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
  SYSTEM = 'system',
}

export const CHAT_MESSAGE_ROLES: readonly ChatMessageRole[] = [
  ChatMessageRole.USER,
  ChatMessageRole.ASSISTANT,
  ChatMessageRole.TOOL,
  ChatMessageRole.SYSTEM,
];
