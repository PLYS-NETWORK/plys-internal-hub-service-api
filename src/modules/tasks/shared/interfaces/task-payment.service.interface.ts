import { Task } from '@database/entities';

import { IBusinessProfileSnapshot } from './task-access.service.interface';

/**
 * Money flows triggered by task status transitions.
 *
 * - `chargeForActivation` is called when a business publishes a task
 *   (`draft → to_do`). For pre-paid businesses it deducts `task.price`
 *   from the business balance and writes a `BusinessTransaction` row.
 *   Credit-based businesses pass through with no charge.
 *
 * - `payoutForCompletion` is called when a business marks a task as `done`.
 *   For pre-paid businesses it credits the consultant balance immediately;
 *   for credit-based businesses it records a pending transaction that the
 *   monthly settlement job will clear.
 *
 * Each method runs inside its own transaction (via `UnitOfWorkService.withTransaction`)
 * and returns the saved `Task`.
 */
export interface ITaskPaymentService {
  /**
   * Pre-paid businesses: deduct `task.price` and write a `TASK_ADDED`
   * transaction. Credit businesses: no-op apart from the status flip.
   * Sets `task.kanbanStatus = TO_DO` and persists.
   *
   * @throws TranslatableException (422) — pre-paid business with insufficient balance.
   */
  chargeForActivation(task: Task, businessProfile: IBusinessProfileSnapshot): Promise<Task>;

  /**
   * Marks task DONE with `approvedBy` and `approvedAt`, then either:
   * - immediately credits consultant balance (`CREDIT_CLEARED` transaction), or
   * - records `CREDIT_PENDING` transaction for monthly settlement.
   * Returns the saved task.
   */
  payoutForCompletion(task: Task, businessProfile: IBusinessProfileSnapshot): Promise<Task>;
}
