import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BillingInvoiceService } from './services/billing-invoice.service';
import { BillingSettlementService } from './services/billing-settlement.service';

@Module({
  imports: [UnitOfWorkModule],
  providers: [BillingSettlementService, BillingInvoiceService],
  exports: [BillingInvoiceService],
})
export class BillingModule {}
