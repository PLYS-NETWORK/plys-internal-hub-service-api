import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { BillingPeriod } from '@plys/libraries/database/entities';
import { BillingPeriodStatus } from '@plys/libraries/database/enums';

export interface IBillingPeriodRepository extends AbstractRepository<BillingPeriod> {
  findWithInvoice(
    skip: number,
    take: number,
    status?: BillingPeriodStatus,
    businessId?: string,
  ): Promise<[BillingPeriod[], number]>;
}
