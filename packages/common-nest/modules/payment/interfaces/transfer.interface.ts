/**
 * Parameters for creating a transfer/payout to a connected account.
 */
export interface ICreateTransferParams {
  /** Amount in cents (e.g., 5000 = $50.00). */
  readonly amount: number;
  /** ISO 4217 currency code, e.g. 'USD'. */
  readonly currency: string;
  /** The connected Stripe account ID to transfer funds to. */
  readonly destinationAccountId: string;
  /** Internal reference ID for idempotency and reconciliation. */
  readonly transactionId: string;
  /** Optional description for the transfer. */
  readonly description?: string;
}

/**
 * Result of a successful transfer.
 */
export interface ITransferResult {
  /** Processor-side transfer ID. */
  readonly processorTransferId: string;
}
