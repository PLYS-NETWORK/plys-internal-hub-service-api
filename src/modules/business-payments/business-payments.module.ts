import { PaymentModule } from '@common/modules/payment/payment.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessPaymentsController } from './business-payments.controller';
import { BusinessPaymentsService } from './business-payments.service';

@Module({
  imports: [UnitOfWorkModule, PaymentModule],
  controllers: [BusinessPaymentsController],
  providers: [BusinessPaymentsService],
})
export class BusinessPaymentsModule {}
