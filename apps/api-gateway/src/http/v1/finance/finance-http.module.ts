import { Module } from '@nestjs/common';

import { FinanceClientsModule } from '@/clients/v1/finance';

import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { BillingController } from './controllers/billing.controller';
import { BusinessPaymentsController } from './controllers/business-payments.controller';
import { ConsultantPaymentsController } from './controllers/consultant-payments.controller';
import { PaymentsController } from './controllers/payments.controller';
import { FINANCE_HTTP_PROVIDERS } from './finance-http.providers';
import { FinanceWebhooksController } from './webhooks.controller';

@Module({
  imports: [FinanceClientsModule],
  controllers: [
    PaymentsController,
    BusinessPaymentsController,
    ConsultantPaymentsController,
    AdminPaymentsController,
    BillingController,
    FinanceWebhooksController,
  ],
  providers: FINANCE_HTTP_PROVIDERS,
})
export class FinanceHttpModule {}
