import { BusinessTransactionType, TransactionStatus } from '@plys/libraries/database/enums';

import { IPayerInfoResponse } from './payer-info.response.interface';

export interface ITransactionResponse {
  /** UUID of the business transaction record. */
  id: string;
  /** Transaction kind (e.g. `top_up`, `project_payment`, `refund`). */
  type: BusinessTransactionType;
  /** Decimal string representation of the base amount before commission. */
  amount: string;
  /** Decimal string commission rate snapshot (e.g. `0.1500`); `null` when commission does not apply. */
  commission_rate: string | null;
  /** Decimal string commission amount = amount × commission_rate; `null` when commission does not apply. */
  commission_amount: string | null;
  /** Decimal string total charged = amount + commission_amount (equals amount when commission is null). */
  total_amount: string;
  /** Current processing status of the transaction (e.g. `pending`, `completed`, `failed`). */
  status: TransactionStatus;
  /** Optional human-readable note attached to the transaction; `null` when absent. */
  note: string | null;
  /**
   * Payer information snapshot captured at checkout creation; `null` for
   * transactions that were not initiated via Polar checkout (e.g. internal
   * project_published / task_added ledger entries).
   */
  payer_info: IPayerInfoResponse | null;
  /**
   * ISO 8601 timestamp rendered in the caller's resolved timezone
   * (business_profile.timezone → x-timezone header → UTC).
   * Includes the offset (e.g. `2026-04-20T19:00:00.000+07:00`).
   */
  created_at: string;
}
