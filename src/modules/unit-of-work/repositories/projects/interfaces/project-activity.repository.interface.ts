/**
 * Categories of activity events the feed accepts as a `?types=` filter.
 * The repository pre-bakes one LIKE pattern per category onto the union.
 */
export type ActivityType = 'task' | 'application' | 'member' | 'project';

/** Concrete event types — the union of every `event_type` the SQL emits. */
export type ActivityEventType =
  | 'task_status_changed'
  | 'application_received'
  | 'application_approved'
  | 'application_rejected'
  | 'member_joined'
  | 'project_status_changed';

/**
 * Raw event row returned from the activity-feed UNION. The service layer
 * shapes this into a response DTO. `actor_user_id` and `actor_name` may both
 * be `null` for system-generated events (e.g. `application_received` — the
 * applicant is captured inside `payload`, not as the actor).
 */
export interface IActivityEventRow {
  event_type: ActivityEventType;
  event_id: string;
  occurred_at: Date;
  actor_user_id: string | null;
  actor_name: string | null;
  payload: Record<string, unknown>;
}

export interface IProjectActivityRepository {
  /**
   * Paginated activity feed for a single project. Sorted `occurred_at DESC`.
   *
   * @param projectId  Project to scope events to.
   * @param skip       Offset.
   * @param take       Page size.
   * @param types      Optional category filter; when omitted all categories return.
   * @returns          Tuple of `[rows, total]`.
   */
  findEventsByProjectId(
    projectId: string,
    skip: number,
    take: number,
    types?: ActivityType[],
  ): Promise<[IActivityEventRow[], number]>;
}
