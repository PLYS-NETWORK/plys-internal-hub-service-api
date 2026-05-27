import { Module } from '@nestjs/common';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { BillingAdminService } from './services/billing-admin.service';
import { BillingInvoiceService } from './services/billing-invoice.service';
import { BillingSettlementService } from './services/billing-settlement.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [],
  providers: [BillingSettlementService, BillingInvoiceService, BillingAdminService],
  exports: [BillingInvoiceService, BillingSettlementService, BillingAdminService],
})
export class BillingModule {}
