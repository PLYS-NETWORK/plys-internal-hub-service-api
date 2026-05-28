import { CompositeTransactionFlow } from '@plys/libraries/database/composite-transactions';

export type CompositeFlowOwnerService =
  | 'identity-service'
  | 'business-service'
  | 'consultant-service'
  | 'internal-task-reviewer-service'
  | 'finance-service';

export interface ICompositeFlowDefinition {
  readonly flow: CompositeTransactionFlow;
  readonly ownerService: CompositeFlowOwnerService;
  readonly participatingPorts: readonly string[];
}

export const COMPOSITE_FLOW_REGISTRY: readonly ICompositeFlowDefinition[] = [
  {
    flow: 'auth.register',
    ownerService: 'identity-service',
    participatingPorts: ['profiles.createProfile'],
  },
  {
    flow: 'auth.sso_first_login',
    ownerService: 'identity-service',
    participatingPorts: ['profiles.createProfile'],
  },
  {
    flow: 'projects.pay_tasks',
    ownerService: 'business-service',
    participatingPorts: ['profiles.ledger', 'tasks.pay'],
  },
  {
    flow: 'projects.ai_sync_tasks',
    ownerService: 'business-service',
    participatingPorts: ['tasks.sync', 'ai.context'],
  },
  {
    flow: 'finance.top_up',
    ownerService: 'finance-service',
    participatingPorts: ['profiles.ledger'],
  },
  {
    flow: 'finance.withdraw',
    ownerService: 'finance-service',
    participatingPorts: ['profiles.ledger'],
  },
  {
    flow: 'finance.billing_settlement',
    ownerService: 'finance-service',
    participatingPorts: ['profiles.ledger', 'billing.invoices'],
  },
  {
    flow: 'finance.webhook_processing',
    ownerService: 'finance-service',
    participatingPorts: ['profiles.ledger', 'billing.invoices'],
  },
] as const;
