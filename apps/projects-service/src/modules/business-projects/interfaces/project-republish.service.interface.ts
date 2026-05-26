/**
 * Republish flow: revert a PUBLISHED project back to CONFIGURED so the
 * business can adjust the configuration and publish again. For pre-paid
 * businesses, the original PROJECT_PUBLISHED charge is refunded to the
 * wallet inside the same transaction.
 */
export interface IProjectRepublishService {
  /**
   * Reverts a PUBLISHED project back to CONFIGURED. For pre-paid
   * businesses (`allowPaymentCredit = false`), the original
   * PROJECT_PUBLISHED charge is refunded to the wallet and a REFUND
   * transaction is recorded — wallet credit + refund txn + status flip
   * are atomic under a row lock on the business profile. Credit-based
   * businesses transition without any financial side-effects.
   *
   * @param projectId Project to revert.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 422 PROJECT_INVALID_STATUS_TRANSITION
   *   when the project is not currently PUBLISHED.
   * @throws TranslatableException 422 PROJECT_RECALL_TRANSACTION_NOT_FOUND
   *   when a pre-paid business has no completed PROJECT_PUBLISHED
   *   transaction on file for the project (cannot determine refund amount).
   */
  republish(projectId: string): Promise<void>;
}
