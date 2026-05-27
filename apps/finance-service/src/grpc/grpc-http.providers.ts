import { BillingController } from '@modules/billing/billing.controller';
import { AdminPaymentsController } from '@modules/payments/admin/admin-payments.controller';
import { BusinessPaymentsController } from '@modules/payments/business/business-payments.controller';
import { ConsultantPaymentsController } from '@modules/payments/consultant/consultant-payments.controller';
import { PaymentsController } from '@modules/payments/payments.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(PaymentsController),
  controllerProvider(BusinessPaymentsController),
  controllerProvider(ConsultantPaymentsController),
  controllerProvider(AdminPaymentsController),
  controllerProvider(BillingController),
];
