import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateProjectDto,
  ListProjectsDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './dto/requests';
import { BusinessProjectResponseDto } from './dto/responses';
import { BusinessProjectService } from './services/business-project.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class ProjectsController {
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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get own project by ID' })
  public async getProject(
    @Param('id') id: string,
  ): Promise<ITranslatedPayload<BusinessProjectResponseDto>> {
    const data = await this.businessProjectService.getProject(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update project fields (replaces skills when provided)' })
  public async updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ITranslatedPayload<BusinessProjectResponseDto>> {
    const data = await this.businessProjectService.updateProject(id, dto);
    return { messageKey: 'success.project.updated', data };
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transition project status',
    description:
      'Status transitions are enforced by a DB trigger. Invalid transitions will return a database error.',
  })
  public async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProjectStatusDto,
  ): Promise<ITranslatedPayload<BusinessProjectResponseDto>> {
    const data = await this.businessProjectService.updateStatus(id, dto);
    return { messageKey: 'success.project.status_updated', data };
  }
}
