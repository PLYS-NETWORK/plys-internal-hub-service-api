import { Injectable } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { IPaymentProvider } from '@plys/libraries/common-nest/modules/payment/interfaces/payment-provider.interface';
import { IPaymentProviderFactory } from '@plys/libraries/common-nest/modules/payment/interfaces/payment-provider-factory.interface';

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
