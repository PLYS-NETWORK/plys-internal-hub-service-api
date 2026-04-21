import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { ConsultantTransactionResponseDto } from '../../dto/responses';

export interface IConsultantPaymentsService {
  listTransactions(dto: PageOptionsDto): Promise<PageDto<ConsultantTransactionResponseDto>>;
}
