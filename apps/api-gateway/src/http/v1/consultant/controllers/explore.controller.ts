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
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ListExploreProjectsDto } from '@plys/libraries/api-contracts/explore/dto/requests/list-explore-projects.dto';
import {
  ExploreProjectDetailResponseDto,
  ExploreProjectListItemResponseDto,
  ExploreSkillResponseDto,
} from '@plys/libraries/api-contracts/explore/dto/responses';
import { THROTTLE_DEFAULT, THROTTLE_PUBLIC_READ } from '@plys/libraries/common-nest/constants';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { ExploreService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Explore')
@ApiSecurity('x-api-key')
@Controller('consultant/explore')
// JwtAuthGuard is registered globally — `@Public()` skips it for these routes.
// `PublicEndpointApiKeyGuard` enforces the BFF shared secret instead.
@Public()
@UseGuards(PublicEndpointApiKeyGuard)
@Throttle(THROTTLE_DEFAULT)
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @Get('skills')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_PUBLIC_READ)
  @ApiOperation({ summary: 'List skills for the explore-page filter dropdown.' })
  public async listSkills(): Promise<ITranslatedPayload<ExploreSkillResponseDto[]>> {
    const data = await this.exploreService.listSkills();
    return { messageKey: 'success.ok', data };
  }

  @Get('projects')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List publicly visible projects. Partner-platform projects are pinned to the top.',
  })
  public async listProjects(
    @Query() dto: ListExploreProjectsDto,
  ): Promise<ITranslatedPayload<PageDto<ExploreProjectListItemResponseDto>>> {
    const data = await this.exploreService.listProjects(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('projects/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public detail view of a single project.' })
  public async getProjectDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ITranslatedPayload<ExploreProjectDetailResponseDto>> {
    const data = await this.exploreService.getProjectDetail(id);
    return { messageKey: 'success.ok', data };
  }
}
