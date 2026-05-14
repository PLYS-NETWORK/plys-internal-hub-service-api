import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../../common/guards/platform.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { BusinessProfilesService } from './business-profiles.service';
import { UpdateBusinessProfileDto } from './dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from './dto/responses/business-profile-response.dto';

// Onboarding lives in `@modules/business-onboarding` (POST /business/onboarding/profile).
// This controller only exposes the post-onboarding self-service routes.
@ApiTags('Business Profiles')
@ApiBearerAuth()
@Controller('business-profiles')
export class BusinessProfilesController {
  constructor(private readonly businessProfilesService: BusinessProfilesService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Get own business profile' })
  public async getProfile(): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.getProfile();
    return { messageKey: 'success.ok', data };
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Update own business profile' })
  public async updateProfile(
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.updateProfile(dto);
    return { messageKey: 'success.business_profile.updated', data };
  }
}
