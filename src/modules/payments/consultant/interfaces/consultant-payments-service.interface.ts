import { PageDto } from '@common/dto/page.dto';

import { ListConsultantTransactionsDto } from '../../dto/requests/list-consultant-transactions.dto';
import { ConsultantTransactionResponseDto } from '../../dto/responses';

export interface IConsultantPaymentsService {
  listTransactions(
    dto: ListConsultantTransactionsDto,
  ): Promise<PageDto<ConsultantTransactionResponseDto>>;
}
