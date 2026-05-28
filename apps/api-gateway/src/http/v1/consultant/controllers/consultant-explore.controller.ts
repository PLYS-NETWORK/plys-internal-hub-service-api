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
import { ListConsultantExploreProjectsDto } from '@plys/libraries/api-contracts/consultant-projects/dto/requests/list-consultant-explore-projects.dto';
import {
  ConsultantExploreProjectDetailResponseDto,
  ConsultantExploreProjectListItemResponseDto,
} from '@plys/libraries/api-contracts/consultant-projects/dto/responses';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ConsultantExploreService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Consultant Projects — Explore')
@ApiBearerAuth()
@Controller('consultant/projects/explore')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
@Throttle(THROTTLE_DEFAULT)
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
