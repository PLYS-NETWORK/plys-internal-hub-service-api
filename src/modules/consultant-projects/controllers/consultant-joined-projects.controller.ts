import { THROTTLE_DISCOVERY } from '@common/constants';
import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
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

import { ListConsultantJoinedProjectsDto } from '../dto/requests/list-consultant-joined-projects.dto';
import { ListConsultantWorkspacesDto } from '../dto/requests/list-consultant-workspaces.dto';
import {
  ConsultantJoinedProjectDetailResponseDto,
  ConsultantJoinedProjectListItemResponseDto,
  ConsultantWorkspaceListItemResponseDto,
} from '../dto/responses';
import { ConsultantJoinedProjectsService } from '../services/consultant-joined-projects.service';

@ApiTags('Consultant Projects — Joined')
@ApiBearerAuth()
@Controller()
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantJoinedProjectsController {
  constructor(private readonly service: ConsultantJoinedProjectsService) {}

  @Get('projects/consultant/workspaces')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_DISCOVERY)
  @ApiOperation({
    summary:
      'Lightweight switcher list of projects the consultant has actively joined. Filters by keyword on title or code. Cached 60 s.',
  })
  public async listWorkspaces(
    @Query() dto: ListConsultantWorkspacesDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantWorkspaceListItemResponseDto>>> {
    const data = await this.service.listWorkspaces(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('projects/consultant/joined')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_DISCOVERY)
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

  @Get('projects/consultant/joined/:projectId')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_DISCOVERY)
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
