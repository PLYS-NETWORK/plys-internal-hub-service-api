import { THROTTLE_DEFAULT } from '@common/constants';
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
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { InviteAdminEmailDto } from './dto/requests/invite-admin-email.dto';
import { ListAdminAllowedEmailsDto } from './dto/requests/list-admin-allowed-emails.dto';
import { SetBooleanFlagDto } from './dto/requests/set-boolean-flag.dto';
import { AdminAllowedEmailResponseDto } from './dto/responses/admin-allowed-email-response.dto';
import { AdminAllowedEmailsService } from './services/admin-allowed-emails.service';

// Admin internal hub for managing the allow-list. Mounted under
// `/admin/allowed-emails`. The global JwtAuthGuard runs first;
// `@Roles(UserRole.ADMIN_PLATFORM)` adds the role check.
@ApiTags('Admin - Allowed Emails')
@ApiBearerAuth()
@Controller('admin/allowed-emails')
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
export class AdminAllowedEmailsController {
  constructor(private readonly adminAllowedEmailsService: AdminAllowedEmailsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite an email to the admin allow-list (Admin only)',
    description:
      'Creates a new active allow-list row and emails the recipient a link to ' +
      '`INTERNAL_HUB_URL`. Rejects with `ADMIN_ALLOWED_EMAIL_ALREADY_EXISTS` if ' +
      'the email is already active and `ADMIN_ALLOWED_EMAIL_REVOKED` if it ' +
      'previously existed but was revoked — the admin should re-activate via ' +
      'the toggle endpoint instead of inviting again. The create + email send ' +
      'run in one transaction so an email-provider failure rolls the row back. ' +
      'The `role` (default `ADMIN_PLATFORM`) is locked at invite time and ' +
      'cannot be changed afterward — to re-assign, revoke the entry and ' +
      'invite the email again with the new role.',
  })
  public async invite(
    @Body() dto: InviteAdminEmailDto,
  ): Promise<ITranslatedPayload<AdminAllowedEmailResponseDto>> {
    const data = await this.adminAllowedEmailsService.invite(dto);
    return { messageKey: 'success.admin.allowed_email_invited', data };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List allow-list entries with last-login (Admin only)',
    description:
      'Returns active and revoked rows by default, paginated. Optional ' +
      '`is_active`, `keywords`, and `role` filters; `role` accepts ' +
      '`ADMIN_PLATFORM` or `TASK_REVIEWER` and composes with the other two. ' +
      '`sort_by` accepts `created_at` (default) or `email`; `order_by` ' +
      "defaults to `DESC`. Each item carries the linked admin user's " +
      '`last_login` (joined from `users.last_login_at`; `null` until first ' +
      'login) and the `role` recorded at invite time.',
  })
  public async list(
    @Query() filters: ListAdminAllowedEmailsDto,
  ): Promise<ITranslatedPayload<PageDto<AdminAllowedEmailResponseDto>>> {
    const data = await this.adminAllowedEmailsService.list(filters);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set is_active on an allow-list entry (Admin only)',
    description:
      'Bidirectional setter — body `{ "value": true | false }`. Blocks toggling ' +
      "the requester's own row (case-insensitive email match) regardless of the " +
      'new value, with `ADMIN_ALLOWED_EMAIL_CANNOT_REVOKE_SELF`.',
  })
  public async setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBooleanFlagDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.adminAllowedEmailsService.setActive(id, dto.value);
    return { messageKey: 'success.admin.allowed_email_active_updated', data: null };
  }
}
