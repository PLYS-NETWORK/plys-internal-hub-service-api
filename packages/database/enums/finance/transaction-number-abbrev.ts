import { BusinessTransactionType } from './business-transaction-type.enum';
import { ConsultantTransactionType } from './consultant-transaction-type.enum';

/**
 * Short-code abbreviations used inside the human-facing `transaction_number`
 * (`[PLS|LN][SHORT_TYPE][YYYYMMDD][N]`). Migration backfill SQL inlines the
 * same mapping; keep both in sync if a new enum value is added.
 */
export const BUSINESS_TXN_TYPE_ABBREV = {
  [BusinessTransactionType.TOP_UP]: 'TOP',
  [BusinessTransactionType.WITHDRAW]: 'WD',
  [BusinessTransactionType.REFUND]: 'REF',
  [BusinessTransactionType.PROJECT_PUBLISHED]: 'PUB',
  [BusinessTransactionType.TASK_ADDED]: 'TSK',
  [BusinessTransactionType.MONTHLY_BILLING]: 'BIL',
} as const satisfies Record<BusinessTransactionType, string>;

export const CONSULTANT_TXN_TYPE_ABBREV = {
  [ConsultantTransactionType.CREDIT_PENDING]: 'CRP',
  [ConsultantTransactionType.CREDIT_CLEARED]: 'CRC',
  [ConsultantTransactionType.DEBIT_PENDING]: 'DBP',
  [ConsultantTransactionType.WITHDRAWAL]: 'WD',
  [ConsultantTransactionType.REVERSAL]: 'REV',
} as const satisfies Record<ConsultantTransactionType, string>;

export type TransactionLedger = 'PLS' | 'LN';

/**
 * Returns the short-code abbreviation for a transaction type. Accepts either
 * enum since the two value sets are disjoint as strings, and the runtime
 * lookup picks the right map. Adding a new enum value without a matching
 * entry in the maps above produces a TS error at the `as const satisfies`
 * lines, not here.
 */
export function shortTypeFor(type: BusinessTransactionType | ConsultantTransactionType): string {
  if (Object.prototype.hasOwnProperty.call(BUSINESS_TXN_TYPE_ABBREV, type)) {
    return BUSINESS_TXN_TYPE_ABBREV[type as BusinessTransactionType];
  }
  return CONSULTANT_TXN_TYPE_ABBREV[type as ConsultantTransactionType];
}
