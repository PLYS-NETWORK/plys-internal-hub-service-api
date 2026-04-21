export interface ISettleInvoiceRequest {
  readonly invoiceId: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
}
