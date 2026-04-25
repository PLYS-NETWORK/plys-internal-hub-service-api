import { HEADERS } from '@common/constants';
import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateProjectDto,
  ListProjectsDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './dto/requests';
import { BusinessProjectResponseDto } from './dto/responses';
import { ProjectMemberResponseDto } from './dto/responses/project-member-response.dto';
import { PublishValidationResponseDto } from './dto/responses/publish-validation-response.dto';
import { BusinessProjectService } from './services/business-project.service';

@ApiTags('Projects - Business')
@ApiBearerAuth()
@ApiHeader({ name: HEADERS.X_DEVICE_ID, required: false, description: 'Unique device identifier for session binding' })
@Controller('projects-business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BusinessProjectController {
  constructor(private readonly businessProjectService: BusinessProjectService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project' })
  public async createProject(
    @Body() dto: CreateProjectDto,
  ): Promise<ITranslatedPayload<BusinessProjectResponseDto>> {
    const data = await this.businessProjectService.createProject(dto);
    return { messageKey: 'success.project.created', data };
  }

  @Get('mine')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List own projects (paginated, filterable by keywords)' })
  public async listMyProjects(
    @Query() dto: ListProjectsDto,
  ): Promise<ITranslatedPayload<PageDto<BusinessProjectResponseDto>>> {
    const data = await this.businessProjectService.listMyProjects(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/publish-validation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check whether a project can be published' })
  public async validatePublish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<PublishValidationResponseDto>> {
    const data = await this.businessProjectService.validatePublish(id);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List project members (consultants) with profile details' })
  public async listProjectMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<ProjectMemberResponseDto>>> {
    const data = await this.businessProjectService.listProjectMembers(id, pageOptions);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm and publish the project' })
  public async confirmPublish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.businessProjectService.confirmPublish(id);
    return { messageKey: 'success.project.published', data: null };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get own project by ID' })
  public async getProject(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<BusinessProjectResponseDto>> {
    const data = await this.businessProjectService.getProject(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update project fields (replaces skills and questions when provided)' })
  public async updateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ITranslatedPayload<BusinessProjectResponseDto>> {
    const data = await this.businessProjectService.updateProject(id, dto);
    return { messageKey: 'success.project.updated', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a draft, setting-up, or configured project' })
  public async deleteProject(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.businessProjectService.deleteProject(id);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transition project status',
    description:
      'Status transitions are enforced by a DB trigger. Invalid transitions will return a database error.',
  })
  public async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectStatusDto,
  ): Promise<ITranslatedPayload<BusinessProjectResponseDto>> {
    const data = await this.businessProjectService.updateStatus(id, dto);
    return { messageKey: 'success.project.status_updated', data };
  }
}
