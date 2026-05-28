import { IPayerInfoRequest } from './payer-info.request.interface';

export interface ISettleInvoiceRequest {
  readonly invoiceId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly payerInfo: IPayerInfoRequest;
}
