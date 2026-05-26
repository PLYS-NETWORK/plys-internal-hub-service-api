/**
 * Payer information snapshot stored on a BusinessTransaction.
 *
 * Captured at checkout-session creation time from the request DTO and
 * forwarded to Polar to pre-fill the hosted checkout. The Polar webhook
 * overwrites `billingAddress` if the user edits it on the hosted page;
 * `name` and `email` are kept from the original request (Polar does not
 * reliably return them in the `order.paid` payload).
 *
 * No card or PCI data is ever stored here — Polar handles all sensitive
 * payment data on its side.
 */
export interface IPayerInfo {
  name: string;
  email: string;
  billingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
  };
}
