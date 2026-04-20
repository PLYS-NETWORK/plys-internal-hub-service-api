import { EnvironmentsService } from '@common/modules/environments';
import { IPaymentProvider } from '@common/modules/payment/interfaces/payment-provider.interface';
import { IPaymentProviderFactory } from '@common/modules/payment/interfaces/payment-provider-factory.interface';
import { Injectable } from '@nestjs/common';

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
