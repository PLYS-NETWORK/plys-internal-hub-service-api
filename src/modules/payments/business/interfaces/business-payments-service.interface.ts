import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { CreateTopUpDto } from '../../dto/requests/create-top-up.dto';
import { TopUpResponseDto, TransactionResponseDto } from '../../dto/responses';

export interface IBusinessPaymentsService {
  createTopUp(dto: CreateTopUpDto): Promise<TopUpResponseDto>;
  listTransactions(dto: PageOptionsDto): Promise<PageDto<TransactionResponseDto>>;
}
