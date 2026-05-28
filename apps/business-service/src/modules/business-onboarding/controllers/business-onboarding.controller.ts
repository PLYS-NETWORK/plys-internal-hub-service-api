import { BusinessProfileResponseDto } from '@modules/profiles/dto/responses/business-profile-response.dto';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { OnboardBusinessProfileDto } from '../dto/requests/onboard-business-profile.dto';
import { BusinessOnboardingService } from '../services/business-onboarding.service';
@Controller('business/onboarding')
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
