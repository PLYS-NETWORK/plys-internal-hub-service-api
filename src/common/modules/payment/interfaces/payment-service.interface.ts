import { ICheckoutSession, ICreateCheckoutSessionParams } from './checkout-session.interface';
import { ICreateRefundParams } from './refund.interface';
import { ICreateTransferParams, ITransferResult } from './transfer.interface';
import { IWebhookEvent } from './webhook-event.interface';

export interface IPaymentService {
  createCheckoutSession(params: ICreateCheckoutSessionParams): Promise<ICheckoutSession>;
  createRefund(params: ICreateRefundParams): Promise<void>;
  constructWebhookEvent(payload: Buffer, headers: Record<string, string>): IWebhookEvent;
  createTransfer(params: ICreateTransferParams): Promise<ITransferResult>;
}
