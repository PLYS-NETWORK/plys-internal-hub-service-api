import { Order } from '@common/dto/page-options.dto';
import { AiAssistantType } from '@database/enums';

export interface IListApiKeysRequest {
  page: number;
  limit: number;
  sort_by?: string;
  order_by?: Order;
  assistantType?: AiAssistantType;
  model?: string;
  keywords?: string;
}
