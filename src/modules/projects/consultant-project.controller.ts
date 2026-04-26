import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
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

import { PlatformGuard } from '../../common/guards/platform.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ConsultantProjectListItemResponseDto,
  ConsultantProjectResponseDto,
} from './dto/responses';
import { ConsultantProjectService } from './services/consultant-project.service';

@ApiTags('Projects - Consultant')
@ApiBearerAuth()
@Controller('projects-consultant')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
export class ConsultantProjectController {
  constructor(private readonly consultantProjectService: ConsultantProjectService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List public projects matching consultant skills (paginated)',
  })
  public async findMatchingProjects(
    @Query() pageOptions: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantProjectListItemResponseDto>>> {
    const data = await this.consultantProjectService.findMatchingProjects(pageOptions);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get public project detail by ID' })
  public async getProjectDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<ConsultantProjectResponseDto>> {
    const data = await this.consultantProjectService.getProjectDetail(id);
    return { messageKey: 'success.ok', data };
  }
}
