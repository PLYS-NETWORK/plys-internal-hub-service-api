import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
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

import {
  ConsultantProjectDetailResponseDto,
  ConsultantProjectListItemResponseDto,
} from '../dto/responses';
import { ConsultantProjectsService } from '../services/projects.service';

@ApiTags('Consultant Projects — Main')
@ApiBearerAuth()
@Controller('projects/consultant')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantProjectsController {
  constructor(private readonly projectsService: ConsultantProjectsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List discoverable projects matching consultant skills',
    description:
      'Paginated list of PUBLISHED / IN_PROGRESS projects requiring at least one of the ' +
      "consultant's skills. Each item carries match_rate, is_available_to_apply, is_applied, " +
      'is_platform_partner, avg_price_per_task (null for PER_MONTH), and payment_type.',
  })
  public async list(
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantProjectListItemResponseDto>>> {
    const data = await this.projectsService.list(pageOptions);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Detail of a single discoverable project' })
  public async getDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ConsultantProjectDetailResponseDto>> {
    const data = await this.projectsService.getDetail(id);
    return { messageKey: 'success.ok', data };
  }
}
