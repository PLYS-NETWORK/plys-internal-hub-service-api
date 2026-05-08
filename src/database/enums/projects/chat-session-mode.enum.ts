export enum ChatSessionMode {
  PLANNING = 'PLANNING',
  REFINE = 'REFINE',
  EXTEND = 'EXTEND',
}

export const CHAT_SESSION_MODES: readonly ChatSessionMode[] = [
  ChatSessionMode.PLANNING,
  ChatSessionMode.REFINE,
  ChatSessionMode.EXTEND,
];
