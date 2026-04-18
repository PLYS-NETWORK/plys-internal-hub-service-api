import { Injectable } from '@nestjs/common';

import { EnvironmentsService } from '../../../environments';
import { IPaymentProvider } from '../../interfaces/payment-provider.interface';
import { IPaymentProviderFactory } from '../../interfaces/payment-provider-factory.interface';
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
