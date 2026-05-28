import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { ListConsultantJoinedProjectsDto } from '../dto/requests/list-consultant-joined-projects.dto';
import {
  ConsultantJoinedProjectDetailResponseDto,
  ConsultantJoinedProjectListItemResponseDto,
  ConsultantWorkspaceListItemResponseDto,
} from '../dto/responses';
import { ConsultantJoinedProjectsService } from '../services/consultant-joined-projects.service';
@Controller()
export class ConsultantJoinedProjectsController {
  constructor(private readonly service: ConsultantJoinedProjectsService) {}
  @Get('projects/consultant/workspaces')
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
  @Get('projects/consultant/joined')
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
  @Get('projects/consultant/joined/:projectId')
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
