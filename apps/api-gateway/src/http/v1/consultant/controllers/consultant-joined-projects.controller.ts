import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ListConsultantJoinedProjectsDto } from '@plys/libraries/api-contracts/consultant-projects/dto/requests/list-consultant-joined-projects.dto';
import {
  ConsultantJoinedProjectDetailResponseDto,
  ConsultantJoinedProjectListItemResponseDto,
  ConsultantWorkspaceListItemResponseDto,
} from '@plys/libraries/api-contracts/consultant-projects/dto/responses';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ConsultantJoinedProjectsService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Consultant Projects — Joined')
@ApiBearerAuth()
@Controller()
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
@Throttle(THROTTLE_DEFAULT)
export class ConsultantJoinedProjectsController {
  constructor(private readonly service: ConsultantJoinedProjectsService) {}

  @Get('consultant/projects/workspaces')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Lightweight switcher list of every project the consultant has actively joined. Returned in full (no pagination, no keyword filter); IN_PROGRESS projects are surfaced first. Cached 60 s.',
  })
  public async listWorkspaces(): Promise<
    ITranslatedPayload<ConsultantWorkspaceListItemResponseDto[]>
  > {
    const data = await this.service.listWorkspaces();
    return { messageKey: 'success.ok', data };
  }

  @Get('consultant/projects/joined')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List of projects the consultant has actively joined, with per-project completion percentage and personal task counters. Cached 60 s.',
  })
  public async listJoinedProjects(
    @Query() dto: ListConsultantJoinedProjectsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantJoinedProjectListItemResponseDto>>> {
    const data = await this.service.listJoinedProjects(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('consultant/projects/joined/:projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Detail view of a joined project, including the consultant-specific progress block. Cached 120 s. 404 when the caller is not an active member.',
  })
  public async getJoinedProjectDetail(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<ITranslatedPayload<ConsultantJoinedProjectDetailResponseDto>> {
    const data = await this.service.getJoinedProjectDetail(projectId);
    return { messageKey: 'success.ok', data };
  }
}
