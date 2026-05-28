import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OnboardBusinessProfileDto } from '@plys/libraries/api-contracts/business-onboarding/dto/requests/onboard-business-profile.dto';
import { BusinessProfileResponseDto } from '@plys/libraries/api-contracts/profiles/dto/responses/business-profile-response.dto';
import { THROTTLE_MODERATE } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { BusinessOnboardingService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Business Onboarding')
@ApiBearerAuth()
@Controller('business/onboarding')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
@Throttle(THROTTLE_MODERATE)
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
