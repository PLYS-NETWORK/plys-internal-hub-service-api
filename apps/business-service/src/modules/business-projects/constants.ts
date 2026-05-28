// Per-project Redis cache for the owner-facing overview endpoint. The
// project-detail screen is hit often once the owner lands; a short TTL keeps
// the payload fresh while still absorbing a burst of repaints.
//
// `v1` suffix lets us roll the response shape without flushing Redis: bump
// the suffix and the next request lands on a fresh key.
export const PROJECT_OVERVIEW_CACHE_KEY = (projectId: string): string =>
  `business:project:overview:${projectId}:v1`;

export const PROJECT_OVERVIEW_CACHE_TTL_SECONDS = 30;

/** Top-N cap for each action-item category on the project overview. */
export const PROJECT_OVERVIEW_ACTION_ITEMS_LIMIT = 5;

/** Recent activity event window — kept identical to today's behaviour. */
export const PROJECT_OVERVIEW_ACTIVITY_LIMIT = 20;

/** Cap on the team-member roster surfaced inline on the overview. */
export const PROJECT_OVERVIEW_TEAM_LIMIT = 50;

/** Stale-review threshold for the at-risk flag (matches dashboard convention). */
export const PROJECT_OVERVIEW_STALE_REVIEW_DAYS = 7;
