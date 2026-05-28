export interface INotificationsDispatchInput {
  readonly userId: string;
  readonly type: string;
  readonly metadata: Record<string, unknown>;
  readonly actorId?: string | null;
  readonly redirectUrlOverride?: string;
}
