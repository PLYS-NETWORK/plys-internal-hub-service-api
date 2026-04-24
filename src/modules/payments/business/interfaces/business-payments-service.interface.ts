import { PageDto } from '@common/dto/page.dto';

import { CreateTopUpDto } from '../../dto/requests/create-top-up.dto';
import { ListBusinessTransactionsDto } from '../../dto/requests/list-business-transactions.dto';
import { SettleInvoiceDto } from '../../dto/requests/settle-invoice.dto';
import {
  SettleInvoiceResponseDto,
  TopUpResponseDto,
  TransactionResponseDto,
} from '../../dto/responses';

export interface IBusinessPaymentsService {
  createTopUp(dto: CreateTopUpDto): Promise<TopUpResponseDto>;
  settleInvoice(dto: SettleInvoiceDto): Promise<SettleInvoiceResponseDto>;
  listTransactions(dto: ListBusinessTransactionsDto): Promise<PageDto<TransactionResponseDto>>;
}
