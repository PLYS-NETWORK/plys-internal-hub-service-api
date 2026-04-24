import { PageDto } from '@common/dto/page.dto';

import { ListBillsDto } from '../dto/requests/list-bills.dto';
import { TriggerSettlementDto } from '../dto/requests/trigger-settlement.dto';
import { BillDetailResponseDto } from '../dto/responses/bill-detail-response.dto';
import { BillListResponseDto } from '../dto/responses/bill-list-response.dto';
import { SendBillResponseDto } from '../dto/responses/send-bill-response.dto';

export interface IBillingAdminService {
  listBills(dto: ListBillsDto): Promise<PageDto<BillListResponseDto>>;
  triggerSettlement(dto: TriggerSettlementDto): Promise<void>;
  getBillDetail(invoiceId: string): Promise<BillDetailResponseDto>;
  sendBillEmail(invoiceId: string): Promise<SendBillResponseDto>;
}
