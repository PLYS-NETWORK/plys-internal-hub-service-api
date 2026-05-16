import { Public } from '@common/decorators/public.decorator';
import { PageDto } from '@common/dto/page.dto';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
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

import { ListExploreProjectsDto } from './dto/requests/list-explore-projects.dto';
import {
  ExploreProjectDetailResponseDto,
  ExploreProjectListItemResponseDto,
  ExploreSkillResponseDto,
} from './dto/responses';
import { ExploreApiKeyGuard } from './guards/explore-api-key.guard';
import { ExploreService } from './services/explore.service';

@ApiTags('Explore')
@ApiSecurity('x-api-key')
@Controller('explore')
// JwtAuthGuard is registered globally — `@Public()` skips it for these routes.
// `ExploreApiKeyGuard` enforces the BFF shared secret instead.
@Public()
@UseGuards(ExploreApiKeyGuard)
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  @Get('skills')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'List skills for the explore-page filter dropdown.' })
  public async listSkills(): Promise<ITranslatedPayload<ExploreSkillResponseDto[]>> {
    const data = await this.exploreService.listSkills();
    return { messageKey: 'success.ok', data };
  }

  @Get('projects')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public detail view of a single project.' })
  public async getProjectDetail(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ITranslatedPayload<ExploreProjectDetailResponseDto>> {
    const data = await this.exploreService.getProjectDetail(id);
    return { messageKey: 'success.ok', data };
  }
}
