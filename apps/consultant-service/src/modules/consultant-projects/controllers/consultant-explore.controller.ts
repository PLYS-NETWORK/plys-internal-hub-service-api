import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { ListConsultantExploreProjectsDto } from '../dto/requests/list-consultant-explore-projects.dto';
import {
  ConsultantExploreProjectDetailResponseDto,
  ConsultantExploreProjectListItemResponseDto,
} from '../dto/responses';
import { ConsultantExploreService } from '../services/consultant-explore.service';
@Controller('projects/consultant/explore')
export class ConsultantExploreController {
  constructor(private readonly service: ConsultantExploreService) {}
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'List discoverable projects for the calling consultant. Partner-platform projects pinned to the top. Cached 60 s, throttled 60 req/min.',
  })
  public async list(
    @Query() dto: ListConsultantExploreProjectsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantExploreProjectListItemResponseDto>>> {
    const data = await this.service.list(dto);
    return { messageKey: 'success.ok', data };
  }
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Detail view of a discoverable project, or one the consultant has joined. Cached 120 s, throttled 60 req/min.',
  })
  public async getDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ITranslatedPayload<ConsultantExploreProjectDetailResponseDto>> {
    const data = await this.service.getDetail(id);
    return { messageKey: 'success.ok', data };
  }
}
