import { Global, Module } from '@nestjs/common';

import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentService } from './payment.service';
import { PolarPaymentProviderFactory } from './providers/polar/polar-payment-provider.factory';
import { StripePaymentProviderFactory } from './providers/stripe/stripe-payment-provider.factory';

/**
 * PaymentModule wires the Strategy Factory Pattern for payment processing.
 *
 * Active provider is determined at runtime by the PAYMENT_PROCESSOR env var
 * (default: 'polar'). Only the selected provider is ever instantiated.
 *
 * To add a new provider:
 *   1. Create XPaymentProvider implements IPaymentProvider
 *   2. Create XPaymentProviderFactory implements IPaymentProviderFactory
 *   3. Add factory to providers[] below
 *   4. Inject it into PaymentProviderRegistry and register it in the Map
 *   — PaymentService is never modified.
 *
 * @Global() makes PaymentService available throughout the application
 * without re-importing this module in every feature module.
 */
@Global()
@Module({
  providers: [
    PolarPaymentProviderFactory,
    StripePaymentProviderFactory,
    PaymentProviderRegistry,
    PaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
