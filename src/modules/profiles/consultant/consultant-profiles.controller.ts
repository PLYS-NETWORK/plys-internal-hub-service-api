import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../../common/guards/platform.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ConsultantProfilesService } from './consultant-profiles.service';
import { OnboardConsultantProfileDto, UpdateConsultantProfileDto } from './dto/requests';
import { ConsultantProfileResponseDto } from './dto/responses';

@ApiTags('Consultant Profiles')
@ApiBearerAuth()
@Controller('consultant-profiles')
export class ConsultantProfilesController {
  constructor(private readonly consultantProfilesService: ConsultantProfilesService) {}

  @Post('onboard')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.CONSULTANT)
  @ApiOperation({ summary: 'Create consultant profile (onboarding)' })
  public async onboard(
    @Body() dto: OnboardConsultantProfileDto,
  ): Promise<ITranslatedPayload<ConsultantProfileResponseDto>> {
    const data = await this.consultantProfilesService.onboard(dto);
    return { messageKey: 'success.consultant_profile.created', data };
  }

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
  @ApiOperation({ summary: 'Update own consultant profile' })
  public async updateProfile(
    @Body() dto: UpdateConsultantProfileDto,
  ): Promise<ITranslatedPayload<ConsultantProfileResponseDto>> {
    const data = await this.consultantProfilesService.updateProfile(dto);
    return { messageKey: 'success.consultant_profile.updated', data };
  }
}
