import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { UserRole } from '@database/enums/user-role.enum';
import { BusinessProfilesService } from './business-profiles.service';
import { OnboardBusinessProfileDto } from './dto/requests/onboard-business-profile.dto';
import { UpdateBusinessProfileDto } from './dto/requests/update-business-profile.dto';
import { BusinessProfileResponseDto } from './dto/responses/business-profile-response.dto';

@ApiTags('Business Profiles')
@ApiBearerAuth()
@Controller('business-profiles')
export class BusinessProfilesController {
  constructor(private readonly businessProfilesService: BusinessProfilesService) {}

  @Post('onboard')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create business profile (onboarding)' })
  public async onboard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: OnboardBusinessProfileDto,
  ): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.onboard(user.sub, dto);
    return { messageKey: 'success.business_profile.created', data };
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update own business profile' })
  public async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.updateProfile(user.sub, dto);
    return { messageKey: 'success.business_profile.updated', data };
  }

  @Patch(':id/verify')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN_PLATFORM)
  @ApiOperation({ summary: 'Verify a business (Admin only)' })
  public async verifyBusiness(
    @Param('id') id: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.businessProfilesService.verifyBusiness(id);
    return { messageKey: 'success.business_profile.verified', data: null };
  }

  @Patch(':id/partner')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN_PLATFORM)
  @ApiOperation({ summary: 'Mark a business as partner platform (Admin only)' })
  public async markAsPartner(
    @Param('id') id: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.businessProfilesService.markAsPartner(id);
    return { messageKey: 'success.business_profile.partner_marked', data: null };
  }

  @Patch(':id/payment-credit')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN_PLATFORM)
  @ApiOperation({ summary: 'Allow a business to use payment credit (Admin only)' })
  public async allowPaymentCredit(
    @Param('id') id: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.businessProfilesService.allowPaymentCredit(id);
    return { messageKey: 'success.business_profile.payment_credit_allowed', data: null };
  }
}
