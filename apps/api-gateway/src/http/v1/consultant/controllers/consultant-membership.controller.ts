import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConsultantMembershipResponseDto } from '@plys/libraries/api-contracts/consultant-projects/dto/responses';
import { THROTTLE_STRICT } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ConsultantMembershipService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Consultant Projects — Membership')
@ApiBearerAuth()
@Controller('consultant/projects/membership')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
@Throttle(THROTTLE_STRICT)
export class ConsultantMembershipController {
  constructor(private readonly service: ConsultantMembershipService) {}

  @Post(':projectId/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Apply (join) a discoverable project. Requires ≥50% required-skill match. Throttled 5 req/min.',
  })
  public async apply(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<ITranslatedPayload<ConsultantMembershipResponseDto>> {
    const data = await this.service.apply(projectId);
    return { messageKey: 'success.membership.applied', data };
  }

  @Post(':projectId/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Leave a project the caller has joined. Blocked while any assigned task is actively in flight. Throttled 5 req/min.',
  })
  public async leave(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<ITranslatedPayload<ConsultantMembershipResponseDto>> {
    const data = await this.service.leave(projectId);
    return { messageKey: 'success.membership.left', data };
  }
}
