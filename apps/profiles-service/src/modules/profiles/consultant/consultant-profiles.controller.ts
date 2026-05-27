import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_DEFAULT, THROTTLE_MODERATE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ConsultantProfilesService } from './consultant-profiles.service';
import { UpdateConsultantProfileDto } from './dto/requests';
import { ConsultantProfileResponseDto } from './dto/responses';

@ApiTags('Consultant Profiles')
@ApiBearerAuth()
@Controller('consultant-profiles')
@Throttle(THROTTLE_DEFAULT)
export class ConsultantProfilesController {
  constructor(private readonly consultantProfilesService: ConsultantProfilesService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.CONSULTANT)
  @ApiOperation({ summary: 'Get own consultant profile' })
  public async getProfile(): Promise<ITranslatedPayload<ConsultantProfileResponseDto>> {
    const data = await this.consultantProfilesService.getProfile();
    return { messageKey: 'success.ok', data };
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.CONSULTANT)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({ summary: 'Update own consultant profile' })
  public async updateProfile(
    @Body() dto: UpdateConsultantProfileDto,
  ): Promise<ITranslatedPayload<ConsultantProfileResponseDto>> {
    const data = await this.consultantProfilesService.updateProfile(dto);
    return { messageKey: 'success.consultant_profile.updated', data };
  }
}
