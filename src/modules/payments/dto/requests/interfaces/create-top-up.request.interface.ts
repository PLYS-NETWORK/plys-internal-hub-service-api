import { IPayerInfoRequest } from './payer-info.request.interface';

export interface ICreateTopUpRequest {
  readonly amount: number;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly payerInfo: IPayerInfoRequest;
}
