import { BillingAdminService } from '@modules/billing/services/billing-admin.service';
import { AdminPaymentsService } from '@modules/payments/admin/admin-payments.service';
import { BusinessPaymentsService } from '@modules/payments/business/business-payments.service';
import { ConsultantPaymentsService } from '@modules/payments/consultant/consultant-payments.service';
import { PaymentsService } from '@modules/payments/payments.service';

import { BillingClient, PaymentsClient } from '@/clients/finance';
import { provideGrpcServiceProxy } from '@/http/shared/grpc-service-proxy.util';

export const FINANCE_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(PaymentsService, PaymentsClient, 'payments', {
    cancelWithdraw: (args) => ({ body: { transactionId: String(args[0]) } }),
  }),
  provideGrpcServiceProxy(BusinessPaymentsService, PaymentsClient, 'businessPayments', {
    continueTopUp: (args) => ({ body: { transactionId: String(args[0]) } }),
    cancelTopUp: (args) => ({ body: { transactionId: String(args[0]) } }),
  }),
  provideGrpcServiceProxy(ConsultantPaymentsService, PaymentsClient, 'consultantPayments'),
  provideGrpcServiceProxy(AdminPaymentsService, PaymentsClient, 'adminPayments'),
  provideGrpcServiceProxy(BillingAdminService, BillingClient, 'billing'),
];
