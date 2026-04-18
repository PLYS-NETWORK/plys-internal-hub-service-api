import { EnvironmentsService } from '../../environments';
import { IPaymentProvider } from './payment-provider.interface';

/**
 * Factory interface — one implementation per provider.
 *
 * Each factory is responsible for instantiating its own IPaymentProvider
 * using the config it needs from EnvironmentsService.
 *
 * To add a new provider:
 *   1. Implement IPaymentProvider
 *   2. Implement IPaymentProviderFactory
 *   3. Register the factory in PaymentModule and PaymentProviderRegistry
 *   — zero changes to PaymentService.
 */
export interface IPaymentProviderFactory {
  create(env: EnvironmentsService): IPaymentProvider;
}
