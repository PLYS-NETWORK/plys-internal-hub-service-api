import { TransactionStatus } from '@plys/libraries/database/enums';

export interface IWithdrawResponse {
  /** `true` if the consultant has already completed Stripe Connect onboarding; `false` otherwise. */
  is_connected: boolean;
  /** Stripe Connect onboarding URL to redirect the consultant to; `null` when already connected. */
  onboarding_url: string | null;
  /** UUID of the withdrawal transaction record created; `null` when onboarding is still required. */
  transaction_id: string | null;
  /** Processing status of the withdrawal; `null` when no transaction was created yet. */
  status: TransactionStatus | null;
}
