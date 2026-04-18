import { ICheckoutSession, ICreateCheckoutSessionParams } from './checkout-session.interface';
import { ICreateRefundParams } from './refund.interface';
import { IWebhookEvent } from './webhook-event.interface';

export interface IPaymentService {
  createCheckoutSession(params: ICreateCheckoutSessionParams): Promise<ICheckoutSession>;
  createRefund(params: ICreateRefundParams): Promise<void>;
  constructWebhookEvent(payload: Buffer, signature: string): IWebhookEvent;
}
