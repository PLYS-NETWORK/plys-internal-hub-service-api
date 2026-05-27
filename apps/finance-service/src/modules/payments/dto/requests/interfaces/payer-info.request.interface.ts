import { IBillingAddressRequest } from './billing-address.request.interface';

export interface IPayerInfoRequest {
  readonly name: string;
  readonly email: string;
  readonly billingAddress: IBillingAddressRequest;
}
