import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { BusinessProfilesService } from './business-profiles.service';
import { UpdateBusinessProfileDto } from './dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from './dto/responses/business-profile-response.dto';
// Onboarding lives in `@modules/business-onboarding` (POST /business/onboarding/profile).
// This controller only exposes the post-onboarding self-service routes.
@Controller('business-profiles')
export class BusinessProfilesController {
  constructor(private readonly businessProfilesService: BusinessProfilesService) {}
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get own business profile' })
  public async getProfile(): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.getProfile();
    return { messageKey: 'success.ok', data };
  }
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own business profile' })
  public async updateProfile(
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.updateProfile(dto);
    return { messageKey: 'success.business_profile.updated', data };
  }
}
