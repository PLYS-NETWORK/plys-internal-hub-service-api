import { THROTTLE_STRICT } from '@common/constants';
import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
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

import { ConsultantMembershipResponseDto } from '../dto/responses';
import { ConsultantMembershipService } from '../services/consultant-membership.service';

@ApiTags('Consultant Projects — Membership')
@ApiBearerAuth()
@Controller('projects/consultant/membership')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantMembershipController {
  constructor(private readonly service: ConsultantMembershipService) {}

  @Post(':projectId/apply')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_STRICT)
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
  @Throttle(THROTTLE_STRICT)
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
