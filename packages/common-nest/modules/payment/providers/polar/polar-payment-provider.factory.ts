import { Injectable } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { IPaymentProvider } from '@plys/libraries/common-nest/modules/payment/interfaces/payment-provider.interface';
import { IPaymentProviderFactory } from '@plys/libraries/common-nest/modules/payment/interfaces/payment-provider-factory.interface';

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
