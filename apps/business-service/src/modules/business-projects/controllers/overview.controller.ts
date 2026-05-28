import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { OverviewResponseDto } from '../dto/responses/overview-response.dto';
import { BusinessProjectOverviewService } from '../services/overview.service';
@Controller('projects/business')
export class BusinessProjectOverviewController {
  constructor(private readonly overviewService: BusinessProjectOverviewService) {}
  @Get(':id/overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Owner-facing project overview, batched into one round trip',
    description:
      'Returns summary, health, money, team (with per-member skills + performance), action_items (top-5 per category), and the most recent 20 activity events. Cached per-project for 30 s.',
  })
  public async getOverview(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<OverviewResponseDto>> {
    const data = await this.overviewService.getOverview(id);
    return { messageKey: 'success.ok', data };
  }
}
