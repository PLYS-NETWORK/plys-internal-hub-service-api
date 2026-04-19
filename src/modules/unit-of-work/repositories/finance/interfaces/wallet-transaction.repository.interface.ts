import { AbstractRepository } from '@common/repositories';
import { WalletTransaction } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IWalletTransactionRepository extends AbstractRepository<WalletTransaction> {}
