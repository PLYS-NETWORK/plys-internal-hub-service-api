import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { BusinessProfileResponseDto } from '@modules/profiles/business/dto/responses/business-profile-response.dto';
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { OnboardBusinessProfileDto } from '../dto/requests/onboard-business-profile.dto';
import { BusinessOnboardingService } from '../services/business-onboarding.service';

@ApiTags('Business Onboarding')
@ApiBearerAuth()
@Controller('business/onboarding')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BusinessOnboardingController {
  constructor(private readonly onboardingService: BusinessOnboardingService) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Submit the business onboarding form — sets company details + tax_id and marks the profile as verified.',
  })
  public async submitProfile(
    @Body() dto: OnboardBusinessProfileDto,
  ): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.onboardingService.onboard(dto);
    return { messageKey: 'success.business_profile.created', data };
  }
}
