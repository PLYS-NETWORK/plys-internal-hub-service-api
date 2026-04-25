import { Task } from '@database/entities';
import { TaskKanbanStatus } from '@database/enums';

/**
 * Strategy contract for moving a task from its current kanban status to a new
 * one on behalf of a specific platform (business / consultant).
 *
 * Each implementation is responsible for:
 * - Validating the transition is allowed for the platform.
 * - Applying any side effects (auto-assign, auto-unassign, payment gate, payout).
 * - Persisting and returning the saved task.
 *
 * Mirrors the `IWithdrawStrategy` pattern at
 * `src/modules/payments/shared/withdraw-strategy.interface.ts`.
 */
export interface ITaskStatusTransitionStrategy {
  /**
   * Validate the requested transition and apply it. Implementations may mutate
   * fields beyond `kanbanStatus` (e.g., set `assignedTo` on auto-assign).
   *
   * @param task   - The current task entity (already loaded by the caller).
   * @param target - The desired target status.
   * @returns The persisted task.
   * @throws TranslatableException — invalid transition, business-rule violation,
   *         insufficient balance, etc.
   */
  transition(task: Task, target: TaskKanbanStatus): Promise<Task>;
}
