import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_DEFAULT, THROTTLE_STRICT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { ListOnboardingsDto } from '../dto/requests/list-onboardings.dto';
import { OnboardingDecisionDto } from '../dto/requests/onboarding-decision.dto';
import { OnboardingDetailResponseDto } from '../dto/responses/onboarding-detail-response.dto';
import { PaginatedOnboardingsResponseDto } from '../dto/responses/onboarding-list-item-response.dto';
import { AdminConsultantOnboardingService } from '../services/admin-consultant-onboarding.service';

@ApiTags('Admin / Consultant Onboardings')
@ApiBearerAuth()
@Controller('admin/onboardings')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
export class AdminConsultantOnboardingController {
  constructor(private readonly service: AdminConsultantOnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'List consultant onboardings (paginated, optional status filter)' })
  public async list(
    @Query() dto: ListOnboardingsDto,
  ): Promise<ITranslatedPayload<PaginatedOnboardingsResponseDto>> {
    const data = await this.service.list(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Onboarding detail (basic info + 10 Q&As)' })
  public async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<OnboardingDetailResponseDto>> {
    const data = await this.service.getDetail(id);
    return { messageKey: 'success.ok', data };
  }

  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_STRICT)
  @ApiOperation({
    summary:
      'Approve or reject the onboarding. Approved unlocks platform; rejected blocks 3 months.',
  })
  public async decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OnboardingDecisionDto,
  ): Promise<ITranslatedPayload<OnboardingDetailResponseDto>> {
    const data = await this.service.decide(id, dto);
    const messageKey =
      dto.decision === 'APPROVED'
        ? 'success.consultant_onboarding.approved'
        : 'success.consultant_onboarding.rejected';
    return { messageKey, data };
  }
}
