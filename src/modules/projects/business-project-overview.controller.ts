import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
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

import { ActivityFeedDto } from './dto/requests/activity-feed.dto';
import {
  ProjectActivityFeedResponseDto,
  ProjectApplicationStatsResponseDto,
  ProjectHeaderResponseDto,
  ProjectInterviewQuestionStatsResponseDto,
  ProjectMembersOverviewResponseDto,
  ProjectTaskStatsResponseDto,
} from './dto/responses';
import { BusinessProjectOverviewService } from './services/business-project-overview.service';

/**
 * Read-only endpoints powering the project overview page (business platform).
 * Mounted under `/projects-business/:id/overview/*` so it does NOT collide
 * with the existing `GET /projects-business/:id` (which returns the rich-edit
 * shape with skills/tasks/questions).
 */
@ApiTags('Projects - Business')
@ApiBearerAuth()
@Controller('projects-business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BusinessProjectOverviewController {
  constructor(private readonly overview: BusinessProjectOverviewService) {}

  @Get(':id/overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Project overview header — title, status, dates, owner, payment' })
  public async getHeader(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ProjectHeaderResponseDto>> {
    const data = await this.overview.getHeader(id);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/overview/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Active member roster + pending-approval count' })
  public async getMembers(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ProjectMembersOverviewResponseDto>> {
    const data = await this.overview.getMembers(id);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/overview/interview-questions/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Per-question completion rates across all applicants' })
  public async getInterviewStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ProjectInterviewQuestionStatsResponseDto>> {
    const data = await this.overview.getInterviewStats(id);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/overview/activity')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paginated activity feed (tasks + applications + members)' })
  public async getActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ActivityFeedDto,
  ): Promise<ITranslatedPayload<ProjectActivityFeedResponseDto>> {
    const data = await this.overview.getActivity(id, query);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/overview/tasks/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kanban task counts grouped by status' })
  public async getTaskStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ProjectTaskStatsResponseDto>> {
    const data = await this.overview.getTaskStats(id);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/overview/applications/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Application counts grouped by status (4 buckets)' })
  public async getApplicationStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ProjectApplicationStatsResponseDto>> {
    const data = await this.overview.getApplicationStats(id);
    return { messageKey: 'success.ok', data };
  }
}
