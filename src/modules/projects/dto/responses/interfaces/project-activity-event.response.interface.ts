import { ActivityEventType } from '@modules/unit-of-work/repositories';

export interface IActivityActor {
  user_id: string;
  full_name: string;
}

export interface IProjectActivityEventResponse {
  event_id: string;
  event_type: ActivityEventType;
  occurred_at: Date;
  /** `null` for system-generated events (e.g. `application_received`). */
  actor: IActivityActor | null;
  /** Shape varies by `event_type` — frontend switches on the type to render. */
  payload: Record<string, unknown>;
}
