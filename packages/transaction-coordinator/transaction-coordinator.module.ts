import { Global, Module } from '@nestjs/common';

import { SharedDbTransactionCoordinator } from './shared-db-transaction.coordinator';

@Global()
@Module({
  providers: [SharedDbTransactionCoordinator],
  exports: [SharedDbTransactionCoordinator],
})
export class TransactionCoordinatorModule {}
