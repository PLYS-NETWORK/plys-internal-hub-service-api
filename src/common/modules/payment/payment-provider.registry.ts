import { Injectable, NotFoundException } from '@nestjs/common';

import { EnvironmentsService } from '@common/modules/environments';
import { PaymentProcessor } from '@database/enums/payment-processor.enum';
import { IPaymentProvider } from './interfaces/payment-provider.interface';
import { IPaymentProviderFactory } from './interfaces/payment-provider-factory.interface';
import { PolarPaymentProviderFactory } from './providers/polar/polar-payment-provider.factory';
import { StripePaymentProviderFactory } from './providers/stripe/stripe-payment-provider.factory';

/**
 * PaymentProviderRegistry is the core of the Strategy Factory Pattern.
 *
 * It holds a Map of all registered IPaymentProviderFactory instances,
 * keyed by PaymentProcessor enum. Instances are lazily created and
 * cached per processor — only the active provider is ever instantiated.
 *
 * To add a new provider:
 *   1. Implement IPaymentProvider + IPaymentProviderFactory
 *   2. Inject the new factory here and register it in the Map
 *   3. Register the factory as a provider in PaymentModule
 *   — PaymentService is never touched.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly factories = new Map<PaymentProcessor, IPaymentProviderFactory>();
  private readonly cache = new Map<PaymentProcessor, IPaymentProvider>();

  constructor(
    private readonly env: EnvironmentsService,
    private readonly polarFactory: PolarPaymentProviderFactory,
    private readonly stripeFactory: StripePaymentProviderFactory,
  ) {
    this.factories.set(PaymentProcessor.POLAR, this.polarFactory);
    this.factories.set(PaymentProcessor.STRIPE, this.stripeFactory);
  }

  /**
   * Returns the IPaymentProvider for the given processor.
   * The instance is created on first call and cached for subsequent calls.
   */
  public create(processor: PaymentProcessor): IPaymentProvider {
    const cached = this.cache.get(processor);
    if (cached) return cached;

    const factory = this.factories.get(processor);
    if (!factory) {
      throw new NotFoundException(
        `No payment provider registered for processor: "${processor}". ` +
          `Registered processors: ${[...this.factories.keys()].join(', ')}.`,
      );
    }

    const provider = factory.create(this.env);
    this.cache.set(processor, provider);
    return provider;
  }
}
