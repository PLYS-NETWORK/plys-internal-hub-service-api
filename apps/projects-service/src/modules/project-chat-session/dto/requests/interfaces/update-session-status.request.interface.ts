import { ChatSessionStatus } from '@plys/libraries/database/enums';

// Used to mark a session `completed` after a successful AI-sync apply, or
// `abandoned` by the housekeeping cron. Inactive → active is not allowed —
// abandoned sessions can be inspected but not re-opened. `created_task_ids`
// is forensic metadata persisted on the session for audit; it never feeds
// back into business logic.
export interface IUpdateSessionStatusRequest {
  status: ChatSessionStatus;
  createdTaskIds?: string[];
}
