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

import { ConsultantOverviewResponseDto } from '../dto/responses';
import { ConsultantOverviewService } from '../services/overview.service';

@ApiTags('Consultant Projects — Overview')
@ApiBearerAuth()
@Controller('projects/consultant')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantOverviewController {
  constructor(private readonly overviewService: ConsultantOverviewService) {}

  @Get(':id/overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Per-project overview for the calling consultant',
    description:
      'Branches on `project.payment_type`. PER_TASK projects return earnings.completed_tasks ' +
      'and earnings.pending_amount; PER_MONTH projects return earnings.payment_history and a ' +
      'next_payment block. days_remaining is always null until a deadline column exists.',
  })
  public async getOverview(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ConsultantOverviewResponseDto>> {
    const data = await this.overviewService.getOverview(id);
    return { messageKey: 'success.ok', data };
  }
}
