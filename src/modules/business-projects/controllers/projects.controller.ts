import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateProjectDto, ListProjectsDto } from '../dto/requests';
import {
  ProjectListItemResponseDto,
  ProjectSummaryResponseDto,
  PublishValidationResponseDto,
} from '../dto/responses';
import { BusinessProjectsService } from '../services/projects.service';

@ApiTags('Business Projects — Main')
@ApiBearerAuth()
@Controller('projects/business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BusinessProjectsController {
  constructor(private readonly projectsService: BusinessProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project (DRAFT)' })
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

  @Get(':id/publish-validation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pre-flight publish validation (read-only)' })
  public async validatePublish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<PublishValidationResponseDto>> {
    const data = await this.projectsService.validatePublish(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Atomically publish the project and settle payment' })
  public async confirmPublish(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.projectsService.confirmPublish(id);
  }
}
