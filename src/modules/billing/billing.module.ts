import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BillingController } from './billing.controller';
import { BillingAdminService } from './services/billing-admin.service';
import { BillingInvoiceService } from './services/billing-invoice.service';
import { BillingSettlementService } from './services/billing-settlement.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [BillingController],
  providers: [BillingSettlementService, BillingInvoiceService, BillingAdminService],
  exports: [BillingInvoiceService, BillingSettlementService],
})
export class BillingModule {}
