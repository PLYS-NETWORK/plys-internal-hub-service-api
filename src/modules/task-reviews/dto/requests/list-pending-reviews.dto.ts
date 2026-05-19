import { PageOptionsDto } from '@common/dto/page-options.dto';

import { IListPendingReviewsRequest } from './interfaces/list-pending-reviews.request.interface';

export class ListPendingReviewsDto extends PageOptionsDto implements IListPendingReviewsRequest {}
