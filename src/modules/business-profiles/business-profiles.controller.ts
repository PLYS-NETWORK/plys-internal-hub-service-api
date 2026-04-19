import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
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
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Create business profile (onboarding)' })
  public async onboard(
    @Body() dto: OnboardBusinessProfileDto,
  ): Promise<ITranslatedPayload<BusinessProfileResponseDto>> {
    const data = await this.businessProfilesService.onboard(dto);
    return { messageKey: 'success.business_profile.created', data };
  }

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

  @Patch(':id/partner')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_PLATFORM)
  @ApiOperation({ summary: 'Mark a business as partner platform (Admin only)' })
  public async markAsPartner(@Param('id') id: string): Promise<ITranslatedPayload<null>> {
    await this.businessProfilesService.markAsPartner(id);
    return { messageKey: 'success.business_profile.partner_marked', data: null };
  }

  @Patch(':id/payment-credit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_PLATFORM)
  @ApiOperation({ summary: 'Allow a business to use payment credit (Admin only)' })
  public async allowPaymentCredit(@Param('id') id: string): Promise<ITranslatedPayload<null>> {
    await this.businessProfilesService.allowPaymentCredit(id);
    return { messageKey: 'success.business_profile.payment_credit_allowed', data: null };
  }
}
