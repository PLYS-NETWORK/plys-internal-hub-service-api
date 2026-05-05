// Single Bull queue name. Adding a new housekeeping job means adding an entry
// to HOUSEKEEPING_JOBS below — no new queue needed.
export const HOUSEKEEPING_QUEUE = 'housekeeping';

// Concrete job names. Used both by `@Process(...)` decorators on the
// processor and by the scheduler that registers repeatable jobs at boot.
export const HOUSEKEEPING_JOBS = {
  EXPIRE_IDEMPOTENCY_KEYS: 'expire-idempotency-keys',
  ABANDON_STALE_SESSIONS: 'abandon-stale-sessions',
  FLAG_PROJECTS_FOR_REINDEX: 'flag-projects-for-reindex',
} as const;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Repeatable cadences. Tuned in the plan §C.7:
//   - idempotency keys live 6h; 15m sweep amortises cleanup
//   - stale-session abandonment runs daily; midnight UTC is a quiet window
//   - reindex-staleness flag is a 7-day sweep; 6h cadence catches it within
//     a quarter of the staleness budget
export const HOUSEKEEPING_SCHEDULES: Record<string, { every?: number; cron?: string }> = {
  [HOUSEKEEPING_JOBS.EXPIRE_IDEMPOTENCY_KEYS]: { every: 15 * MIN },
  [HOUSEKEEPING_JOBS.ABANDON_STALE_SESSIONS]: { cron: '0 0 * * *' },
  [HOUSEKEEPING_JOBS.FLAG_PROJECTS_FOR_REINDEX]: { every: 6 * HOUR },
};

// Stale-session policy: rows that haven't moved in 90 days AND have fewer
// than 5 messages are considered abandoned. Both thresholds are deliberate —
// long-running planning chats (90+ days but with real history) stay active
// so the FE picker can still surface them.
export const ABANDON_STALE_SESSION_DAYS = 90;
export const ABANDON_STALE_SESSION_MIN_MESSAGES = 5;

// Reindex-staleness budget: 7 days since last derived-write before the cron
// flips `needs_reindex`. Matches the FE's polling assumption.
export const REINDEX_STALENESS_DAYS = 7;
