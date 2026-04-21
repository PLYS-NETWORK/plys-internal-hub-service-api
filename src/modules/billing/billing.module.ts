import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BillingSettlementService } from './services/billing-settlement.service';

@Module({
  imports: [UnitOfWorkModule],
  providers: [BillingSettlementService],
})
export class BillingModule {}
