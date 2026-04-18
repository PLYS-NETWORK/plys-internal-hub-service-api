import { Injectable } from '@nestjs/common';

import { EnvironmentsService } from '../../../environments';
import { IPaymentProvider } from '../../interfaces/payment-provider.interface';
import { IPaymentProviderFactory } from '../../interfaces/payment-provider-factory.interface';
import { StripePaymentProvider } from './stripe-payment.provider';

/**
 * Factory Strategy for Stripe.
 * Registered in PaymentProviderRegistry under PaymentProcessor.STRIPE.
 */
@Injectable()
export class StripePaymentProviderFactory implements IPaymentProviderFactory {
  public create(env: EnvironmentsService): IPaymentProvider {
    return new StripePaymentProvider(env);
  }
}
