import { InviteAdminEmailDto } from '@modules/admin-auth/dto/requests/invite-admin-email.dto';
import { ListAdminAllowedEmailsDto } from '@modules/admin-auth/dto/requests/list-admin-allowed-emails.dto';
import { SetBooleanFlagDto } from '@modules/admin-auth/dto/requests/set-boolean-flag.dto';
import { AdminAllowedEmailResponseDto } from '@modules/admin-auth/dto/responses/admin-allowed-email-response.dto';
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
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { GrpcGatewayHelper } from '@plys/libraries/common-nest/grpc';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { IdentityAdminAllowedEmailsClient } from '@/clients/identity';

@ApiTags('Admin - Allowed Emails')
@ApiBearerAuth()
@Controller('admin/allowed-emails')
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
export class AdminAllowedEmailsController {
  constructor(
    private readonly adminAllowedEmailsClient: IdentityAdminAllowedEmailsClient,
    private readonly grpcHelper: GrpcGatewayHelper,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite an email to the admin allow-list (Admin only)',
  })
  public invite(
    @Body() dto: InviteAdminEmailDto,
  ): Promise<ITranslatedPayload<AdminAllowedEmailResponseDto>> {
    return this.grpcHelper.call(this.adminAllowedEmailsClient, 'invite', { body: dto });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List allow-list entries with last-login (Admin only)',
  })
  public list(
    @Query() filters: ListAdminAllowedEmailsDto,
  ): Promise<ITranslatedPayload<PageDto<AdminAllowedEmailResponseDto>>> {
    return this.grpcHelper.call(this.adminAllowedEmailsClient, 'list', { body: filters });
  }

  @Patch(':id/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set is_active on an allow-list entry (Admin only)',
  })
  public setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBooleanFlagDto,
  ): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.adminAllowedEmailsClient, 'setActive', {
      body: dto,
      pathParams: { id },
    });
  }
}
