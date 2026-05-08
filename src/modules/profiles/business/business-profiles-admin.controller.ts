import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BusinessProfilesAdminService } from './business-profiles-admin.service';
import { ListBusinessProfilesDto } from './dto/requests/list-business-profiles.dto';
import { SetBooleanFlagDto } from './dto/requests/set-boolean-flag.dto';
import { AdminBusinessProfileDetailResponseDto } from './dto/responses/admin-business-profile-detail-response.dto';
import { AdminBusinessProfileListItemResponseDto } from './dto/responses/admin-business-profile-list-item-response.dto';

// Admin internal hub for managing business profiles. Mounted under
// `/admin/business-profiles`. The global JwtAuthGuard runs first;
// `@Roles(UserRole.ADMIN_PLATFORM)` adds the role check.
@ApiTags('Admin - Business Profiles')
@ApiBearerAuth()
@Controller('admin/business-profiles')
@Roles(UserRole.ADMIN_PLATFORM)
export class BusinessProfilesAdminController {
  constructor(private readonly adminService: BusinessProfilesAdminService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List business profiles (paginated, filterable) (Admin only)',
    description:
      'Returns non-soft-deleted business profiles. Optional filters: ' +
      '`is_partner_platform` and `is_verified` (booleans). `sort_by` accepts ' +
      '`created_at` (default), `updated_at`, or `company_name`; `order_by` ' +
      'accepts `ASC` or `DESC` (default `DESC`). The list joins the linked ' +
      '`users` row to surface `email`, `register_date`, and `last_login`.',
  })
  public async list(
    @Query() filters: ListBusinessProfilesDto,
  ): Promise<ITranslatedPayload<PageDto<AdminBusinessProfileListItemResponseDto>>> {
    const data = await this.adminService.list(filters);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a business profile by id (Admin only)',
    description:
      'Returns the full profile plus the linked auth account `email`, ' +
      '`register_date` (`users.created_at`), and `last_login` ' +
      '(`users.last_login_at`, `null` until first login).',
  })
  public async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<AdminBusinessProfileDetailResponseDto>> {
    const data = await this.adminService.getById(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/partner-platform')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set is_partner_platform on a business profile (Admin only)',
    description: 'Bidirectional setter — body `{ "value": true | false }`.',
  })
  public async setPartnerPlatform(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBooleanFlagDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.adminService.setPartnerPlatform(id, dto.value);
    return { messageKey: 'success.business_profile.partner_platform_updated', data: null };
  }

  @Patch(':id/payment-credit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set allow_payment_credit on a business profile (Admin only)',
    description: 'Bidirectional setter — body `{ "value": true | false }`.',
  })
  public async setAllowPaymentCredit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBooleanFlagDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.adminService.setAllowPaymentCredit(id, dto.value);
    return { messageKey: 'success.business_profile.payment_credit_updated', data: null };
  }
}
