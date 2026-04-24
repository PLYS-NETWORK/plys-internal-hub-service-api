import { AbstractRepository } from '@common/repositories';
import { BillingPeriod } from '@database/entities';
import { BillingPeriodStatus } from '@database/enums';

export interface IBillingPeriodRepository extends AbstractRepository<BillingPeriod> {
  findWithInvoice(
    skip: number,
    take: number,
    status?: BillingPeriodStatus,
    businessId?: string,
  ): Promise<[BillingPeriod[], number]>;
}
