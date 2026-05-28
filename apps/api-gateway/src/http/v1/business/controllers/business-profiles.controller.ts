import { Body, Controller, Get, HttpCode, HttpStatus, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UpdateBusinessProfileDto } from '@plys/libraries/api-contracts/profiles/dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from '@plys/libraries/api-contracts/profiles/dto/responses/business-profile-response.dto';
import { THROTTLE_DEFAULT, THROTTLE_MODERATE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { BusinessProfilesService } from '@/http/v1/shared/grpc-service-tokens';

// Onboarding lives in `@modules/business-onboarding` (POST /business/onboarding/profile).
// This controller only exposes the post-onboarding self-service routes.
@ApiTags('Business Profiles')
@ApiBearerAuth()
@Controller('business/profiles')
@Throttle(THROTTLE_DEFAULT)
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
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({ summary: 'Update own business profile' })
  public async updateProfile(
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.updateProfile(dto);
    return { messageKey: 'success.business_profile.updated', data };
  }
}
