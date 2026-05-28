export interface IBillingAddressResponse {
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly state: string | null;
  readonly postal_code: string;
  readonly country: string;
}

export interface IPayerInfoResponse {
  readonly name: string;
  readonly email: string;
  readonly billing_address: IBillingAddressResponse;
}
