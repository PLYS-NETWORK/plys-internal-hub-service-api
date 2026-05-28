import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ListConsultantProfilesAdminDto } from '@plys/libraries/api-contracts/profiles/dto/requests/list-consultant-profiles-admin.dto';
import { AdminConsultantProfileDetailResponseDto } from '@plys/libraries/api-contracts/profiles/dto/responses/admin-consultant-profile-detail-response.dto';
import { AdminConsultantProfileListItemResponseDto } from '@plys/libraries/api-contracts/profiles/dto/responses/admin-consultant-profile-list-item-response.dto';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { ConsultantProfilesAdminService } from '@/http/v1/shared/grpc-service-tokens';

// Admin internal hub for managing consultant profiles. Mounted under
// `/admin/consultant-profiles`. The global JwtAuthGuard runs first;
// `@Roles(UserRole.ADMIN_PLATFORM)` adds the role check.
@ApiTags('Admin - Consultant Profiles')
@ApiBearerAuth()
@Controller('admin/profiles/consultant')
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
export class ConsultantProfilesAdminController {
  constructor(private readonly adminService: ConsultantProfilesAdminService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List onboarding-approved consultant profiles (paginated) (Admin only)',
    description:
      'Returns non-soft-deleted consultant profiles that have passed onboarding ' +
      'approval (`is_verified = true`, atomically set when an admin moves ' +
      '`consultant_onboardings.status` to `APPROVED`). Optional filter: ' +
      '`has_notification_priority` (boolean). `sort_by` accepts `created_at` ' +
      '(default), `updated_at`, or `full_name`; `order_by` accepts `ASC` or ' +
      '`DESC` (default `DESC`). The list joins the linked `users` row to surface ' +
      '`email`, `register_date`, and `last_login`, and re-presigns `avatar_url`.',
  })
  public async list(
    @Query() filters: ListConsultantProfilesAdminDto,
  ): Promise<ITranslatedPayload<PageDto<AdminConsultantProfileListItemResponseDto>>> {
    const data = await this.adminService.list(filters);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a consultant profile by id (Admin only)',
    description:
      'Returns the full consultant profile (admin-visible columns: `cv_url`, ' +
      '`stripe_connect_account_id`, `has_notification_priority`, `avg_rating`), ' +
      'the declared skills, and the linked auth account `email`, `register_date` ' +
      '(`users.created_at`), and `last_login` (`users.last_login_at`, `null` ' +
      'until first login). `avatar_url` and `cv_url` are re-presigned before ' +
      'returning. Detail does NOT enforce `is_verified = true` so admins can ' +
      'inspect mid-onboarding rows.',
  })
  public async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<AdminConsultantProfileDetailResponseDto>> {
    const data = await this.adminService.getById(id);
    return { messageKey: 'success.ok', data };
  }
}
