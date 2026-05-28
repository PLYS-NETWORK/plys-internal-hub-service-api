import { BillingClient, PaymentsClient } from '@/clients/v1/finance';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import {
  AdminPaymentsService,
  BillingAdminService,
  BusinessPaymentsService,
  ConsultantPaymentsService,
  PaymentsService,
} from '@/http/v1/shared/grpc-service-tokens';

export const FINANCE_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(PaymentsService, PaymentsClient, 'payments', {
    cancelWithdraw: (args: unknown[]) => ({ body: { transactionId: String(args[0]) } }),
  }),
  provideGrpcServiceProxy(BusinessPaymentsService, PaymentsClient, 'businessPayments', {
    continueTopUp: (args: unknown[]) => ({ body: { transactionId: String(args[0]) } }),
    cancelTopUp: (args: unknown[]) => ({ body: { transactionId: String(args[0]) } }),
  }),
  provideGrpcServiceProxy(ConsultantPaymentsService, PaymentsClient, 'consultantPayments'),
  provideGrpcServiceProxy(AdminPaymentsService, PaymentsClient, 'adminPayments'),
  provideGrpcServiceProxy(BillingAdminService, BillingClient, 'billing'),
];
