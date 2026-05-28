import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OverviewResponseDto } from '@plys/libraries/api-contracts/business-projects/dto/responses/overview-response.dto';
import { THROTTLE_INTERACTIVE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { BusinessProjectOverviewService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Business Projects — Overview')
@ApiBearerAuth()
@Controller('business/projects')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
@Throttle(THROTTLE_INTERACTIVE)
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
