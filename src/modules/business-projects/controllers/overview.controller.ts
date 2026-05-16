import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
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

import { OverviewResponseDto } from '../dto/responses/overview-response.dto';
import { BusinessProjectOverviewService } from '../services/overview.service';

@ApiTags('Business Projects — Overview')
@ApiBearerAuth()
@Controller('projects/business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
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
