import { AbstractRepository } from '@common/repositories';
import { Invoice } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IInvoiceRepository extends AbstractRepository<Invoice> {}
