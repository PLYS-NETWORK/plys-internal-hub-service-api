export {
  COMPOSITE_FLOW_REGISTRY,
  type CompositeFlowOwnerService,
  type ICompositeFlowDefinition,
} from './composite-flow.registry';
export type {
  ICrossServicePort,
  SharedDbTransaction,
} from './interfaces/cross-service-port.interface';
export {
  SharedDbTransactionCoordinator,
  type SharedDbWork,
} from './shared-db-transaction.coordinator';
export { TransactionCoordinatorModule } from './transaction-coordinator.module';
