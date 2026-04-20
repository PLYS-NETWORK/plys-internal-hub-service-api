import { EnvironmentsService } from '@common/modules/environments';
import { IPaymentProvider } from '@common/modules/payment/interfaces/payment-provider.interface';
import { IPaymentProviderFactory } from '@common/modules/payment/interfaces/payment-provider-factory.interface';
import { Injectable } from '@nestjs/common';

import { PolarPaymentProvider } from './polar-payment.provider';

/**
 * Factory Strategy for Polar.sh.
 * Registered in PaymentProviderRegistry under PaymentProcessor.POLAR.
 */
@Injectable()
export class PolarPaymentProviderFactory implements IPaymentProviderFactory {
  public create(env: EnvironmentsService): IPaymentProvider {
    return new PolarPaymentProvider(env);
  }
}
