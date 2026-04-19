import { AbstractRepository } from '@common/repositories';
import { InvoiceLineItem } from '@database/entities';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IInvoiceLineItemRepository extends AbstractRepository<InvoiceLineItem> {}
