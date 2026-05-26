import { Module } from '@nestjs/common';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import { PaymentModule } from '@plys/libraries/common-nest/modules/payment/payment.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { AdminPaymentsService } from './admin/admin-payments.service';
import { BusinessPaymentsService } from './business/business-payments.service';
import { BusinessWithdrawStrategy } from './business/business-withdraw.strategy';
import { ConsultantPaymentsService } from './consultant/consultant-payments.service';
import { ConsultantWithdrawStrategy } from './consultant/consultant-withdraw.strategy';
import { PaymentsService } from './payments.service';

@Module({
  imports: [UnitOfWorkModule, PaymentModule, EmailModule],
  controllers: [],
  providers: [
    PaymentsService,
    BusinessPaymentsService,
    ConsultantPaymentsService,
    AdminPaymentsService,
    BusinessWithdrawStrategy,
    ConsultantWithdrawStrategy,
  ],
})
export class PaymentsModule {}
