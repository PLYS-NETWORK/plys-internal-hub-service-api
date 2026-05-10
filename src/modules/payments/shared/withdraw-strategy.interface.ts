import { CancelWithdrawResponseDto } from '../dto/responses/cancel-withdraw-response.dto';
import { WithdrawResponseDto } from '../dto/responses/withdraw-response.dto';

/**
 * Strategy interface for platform-specific withdrawal logic.
 *
 * Why Strategy pattern: Business and Consultant use different entities
 * (`BusinessTransaction` vs `ConsultantTransaction`), different balance
 * fields, and different profile tables. A shared interface lets the
 * `PaymentsService` delegate without knowing the concrete platform.
 */
export interface IWithdrawStrategy {
  /**
   * Executes the platform-specific withdrawal flow.
   *
   * If the caller's Stripe Connect account is not yet linked, returns an
   * `onboarding_url` for the OAuth flow without debiting the balance.
   * Otherwise, validates the balance, creates a transfer via Stripe Connect,
   * and records the transaction atomically inside a database transaction.
   *
   * @param amount     - Amount to withdraw in USD (not cents).
   * @param successUrl - URL the frontend redirects to after successful Stripe OAuth.
   * @param cancelUrl  - URL the frontend redirects to if the OAuth flow is cancelled.
   * @returns DTO containing connection status, optional onboarding URL, and transaction details.
   * @throws TranslatableException (404) — caller profile not found.
   * @throws TranslatableException (422) — account balance is insufficient for the requested amount.
   * @throws TranslatableException (500) — Stripe transfer failed.
   */
  execute(amount: number, successUrl: string, cancelUrl: string): Promise<WithdrawResponseDto>;

  /**
   * Cancels a PENDING withdrawal transaction, restores the deducted balance,
   * and notifies the user via push notification and email.
   *
   * Intended as a safety valve for transactions stranded in PENDING due to a
   * server crash or gateway timeout after the balance was already deducted.
   *
   * @param transactionId - UUID of the pending withdrawal transaction.
   * @returns DTO with the final transaction status and the restored balance amount.
   * @throws TranslatableException (404) — caller profile or transaction not found.
   * @throws TranslatableException (403) — transaction does not belong to the caller.
   * @throws TranslatableException (409) — transaction is not a pending withdrawal.
   */
  cancelWithdraw(transactionId: string): Promise<CancelWithdrawResponseDto>;
}
