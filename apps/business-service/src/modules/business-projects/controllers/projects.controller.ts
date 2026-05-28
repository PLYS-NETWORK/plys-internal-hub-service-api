import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IdempotencyKey } from '@plys/libraries/common-nest/decorators/idempotency-key.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { CreateProjectDto, ListProjectsDto } from '../dto/requests';
import { TransitionProjectStatusDto } from '../dto/requests/transition-project-status.dto';
import {
  ProjectListItemResponseDto,
  ProjectSearchItemResponseDto,
  ProjectSummaryResponseDto,
  PublishValidationResponseDto,
} from '../dto/responses';
import { ProjectPublishService } from '../services/projects/project-publish.service';
import { ProjectRepublishService } from '../services/projects/project-republish.service';
import { BusinessProjectsService } from '../services/projects/projects.service';
@Controller('projects/business')
export class BusinessProjectsController {
  constructor(
    private readonly projectsService: BusinessProjectsService,
    private readonly publishService: ProjectPublishService,
    private readonly republishService: ProjectRepublishService,
  ) {}
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new project (DRAFT)',
    description:
      'Creates a project owned by the authenticated business profile. ' +
      'The required `code` is a human-readable identifier (uppercase A-Z and 0-9, 2-8 characters) ' +
      'that must be unique within the business profile and is used as the prefix for task codes ' +
      '(e.g. `WEB-1`). Returns 409 `PROJECT_CODE_ALREADY_EXISTS` if the code is already taken.',
  })
  public async createProject(
    @Body() dto: CreateProjectDto,
  ): Promise<ITranslatedPayload<ProjectSummaryResponseDto>> {
    const data = await this.projectsService.createProject(dto);
    return { messageKey: 'success.project.created', data };
  }
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List the calling business's own projects" })
  public async listMyProjects(
    @Query() dto: ListProjectsDto,
  ): Promise<ITranslatedPayload<PageDto<ProjectListItemResponseDto>>> {
    const data = await this.projectsService.listMyProjects(dto);
    return { messageKey: 'success.ok', data };
  }
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lightweight switcher list (every owned project)',
    description:
      'Returns a minimal `{ id, code, title }` payload for every project owned by the caller. ' +
      'No pagination, no keyword filter. IN_PROGRESS projects are surfaced first.',
  })
  public async searchMyProjects(): Promise<ITranslatedPayload<ProjectSearchItemResponseDto[]>> {
    const data = await this.projectsService.searchMyProjects();
    return { messageKey: 'success.ok', data };
  }
  @Get(':id/publish-validation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pre-flight publish validation (read-only)' })
  public async validatePublish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<PublishValidationResponseDto>> {
    const data = await this.publishService.validatePublish(id);
    return { messageKey: 'success.ok', data };
  }
  @Patch(':id/publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Atomically publish the project and settle payment' })
  public async confirmPublish(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.publishService.confirmPublish(id);
  }
  @Patch(':id/re-publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revert a PUBLISHED project to CONFIGURED so it can be re-published',
    description:
      'Only allowed while the project is `published` — once a task is assigned the project is `in_progress` and republish is rejected. ' +
      'Side effects: every non-DRAFT task is reset back to `draft` (display_order recomputed); the original publish fee and every prior `task_added` charge are refunded as REFUND transactions (PRE_PAID) or REVERSED (CREDIT).',
  })
  public async republish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.republishService.republish(id);
    return { messageKey: 'success.project.re_published', data: null };
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a project (only DRAFT or CONFIGURED)',
    description:
      'Soft-deletes a project owned by the calling business. ' +
      'Returns 422 `PROJECT_CANNOT_BE_DELETED` when the project is past `CONFIGURED` ' +
      '(i.e. `PUBLISHED`, `IN_PROGRESS`, `DONE`, or `CANCELLED`) — those carry financial / member state and must go through the cancellation flow instead.',
  })
  public async deleteProject(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.projectsService.deleteProject(id);
  }
  @Patch(':id/status')
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Explicit `draft → configured` transition with a price-gate check',
    description:
      'Used by the AI implementation runner to "stamp" a planning session as ' +
      'configured before the user proceeds to publish. Rejects with 409 + ' +
      '`details: { offending_task_ids }` if any draft task has `price = 0`. ' +
      'Idempotent — pass `Idempotency-Key` to make retries safe.',
  })
  public async transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionProjectStatusDto,
  ): Promise<ITranslatedPayload<ProjectSummaryResponseDto>> {
    const data = await this.projectsService.transitionStatus(id, dto);
    return { messageKey: 'success.ok', data };
  }
}
