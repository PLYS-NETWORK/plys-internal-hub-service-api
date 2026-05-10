import { EmailModule } from '@common/modules/email';
import { PaymentModule } from '@common/modules/payment/payment.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessPaymentsController } from './business/business-payments.controller';
import { BusinessPaymentsService } from './business/business-payments.service';
import { BusinessWithdrawStrategy } from './business/business-withdraw.strategy';
import { ConsultantPaymentsController } from './consultant/consultant-payments.controller';
import { ConsultantPaymentsService } from './consultant/consultant-payments.service';
import { ConsultantWithdrawStrategy } from './consultant/consultant-withdraw.strategy';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [UnitOfWorkModule, PaymentModule, NotificationsModule, EmailModule],
  controllers: [PaymentsController, BusinessPaymentsController, ConsultantPaymentsController],
  providers: [
    PaymentsService,
    BusinessPaymentsService,
    ConsultantPaymentsService,
    BusinessWithdrawStrategy,
    ConsultantWithdrawStrategy,
  ],
})
export class PaymentsModule {}
