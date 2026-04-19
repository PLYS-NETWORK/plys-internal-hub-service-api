import { AbstractRepository } from '@common/repositories';
import { BusinessTransaction } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IBusinessTransactionRepository
  extends AbstractRepository<BusinessTransaction> {}
