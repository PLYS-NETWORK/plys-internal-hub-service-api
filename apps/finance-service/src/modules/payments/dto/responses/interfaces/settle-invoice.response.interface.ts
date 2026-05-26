export interface ISettleInvoiceResponse {
  /** UUID of the invoice that was submitted for settlement. */
  readonly invoice_id: string;
  /** Payment provider URL the client must redirect the user to in order to complete payment. */
  readonly redirect_url: string;
}
