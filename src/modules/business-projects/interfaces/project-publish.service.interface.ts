import { PublishValidationResponseDto } from '../dto/responses';

/**
 * Two-step publish flow: pre-flight `validatePublish` for the modal, then
 * `confirmPublish` to atomically settle payment and flip status to PUBLISHED.
 */
export interface IProjectPublishService {
  /**
   * Returns a read-only validation result for the publish modal. Does not
   * change any state.
   *
   * @param projectId Project to validate.
   * @returns Publish eligibility, project amount, commission, account balance.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project does
   *   not exist or is not owned by the calling business.
   */
  validatePublish(projectId: string): Promise<PublishValidationResponseDto>;

  /**
   * Atomically transitions the project to PUBLISHED and settles payment.
   * Re-runs validation inside the locked transaction; pre-flight
   * `validatePublish` is advisory only. Sends a post-publish receipt
   * (pre-paid) or success (credit) email; email failures do not roll
   * back the publish.
   *
   * @param projectId Project to publish.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 422 PROJECT_INSUFFICIENT_BALANCE
   *   (pre-paid only, locked re-check).
   * @throws TranslatableException 422 PROJECT_CANNOT_PUBLISH for any other
   *   non-eligibility (zero tasks, wrong status, etc.).
   */
  confirmPublish(projectId: string): Promise<void>;
}
