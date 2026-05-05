export enum ChatSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export const CHAT_SESSION_STATUSES: readonly ChatSessionStatus[] = [
  ChatSessionStatus.ACTIVE,
  ChatSessionStatus.COMPLETED,
  ChatSessionStatus.ABANDONED,
];
