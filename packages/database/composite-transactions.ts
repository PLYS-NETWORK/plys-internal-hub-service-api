/** Composite transactions that span repos outside a single bounded context. */
export const COMPOSITE_TRANSACTION_FLOWS = [
  'auth.register',
  'auth.sso_first_login',
  'projects.pay_tasks',
  'projects.ai_sync_tasks',
  'finance.top_up',
  'finance.withdraw',
  'finance.billing_settlement',
  'finance.webhook_processing',
] as const;

export type CompositeTransactionFlow = (typeof COMPOSITE_TRANSACTION_FLOWS)[number];
