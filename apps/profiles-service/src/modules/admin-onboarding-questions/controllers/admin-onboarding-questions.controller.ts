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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_DEFAULT, THROTTLE_MODERATE } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import {
  CreateOnboardingQuestionDto,
  ListInactiveOnboardingQuestionsDto,
  ReorderOnboardingQuestionsDto,
  SetActiveFlagDto,
  UpdateOnboardingQuestionDto,
} from '../dto/requests';
import { OnboardingQuestionResponseDto } from '../dto/responses';
import { AdminOnboardingQuestionsService } from '../services/admin-onboarding-questions.service';

@ApiTags('Admin / Onboarding Questions')
@ApiBearerAuth()
@Controller('admin/onboarding-questions')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
export class AdminOnboardingQuestionsController {
  constructor(private readonly service: AdminOnboardingQuestionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary:
      'Create an onboarding question. When is_active=true (default), it is appended to the end of the active set.',
  })
  public async create(
    @Body() dto: CreateOnboardingQuestionDto,
  ): Promise<ITranslatedPayload<OnboardingQuestionResponseDto>> {
    const data = await this.service.create(dto);
    return { messageKey: 'success.onboarding_question.created', data };
  }

  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all active questions ordered by position. No pagination.' })
  public async listActive(): Promise<ITranslatedPayload<OnboardingQuestionResponseDto[]>> {
    const data = await this.service.listActive();
    return { messageKey: 'success.ok', data };
  }

  @Get('inactive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Paginated list of inactive questions, sorted by most-recently updated.',
  })
  public async listInactive(
    @Query() dto: ListInactiveOnboardingQuestionsDto,
  ): Promise<ITranslatedPayload<PageDto<OnboardingQuestionResponseDto>>> {
    const data = await this.service.listInactive(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single onboarding question (including soft-deleted).' })
  public async getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<OnboardingQuestionResponseDto>> {
    const data = await this.service.getById(id);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary: 'Update question text and/or options. Type is immutable.',
  })
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOnboardingQuestionDto,
  ): Promise<ITranslatedPayload<OnboardingQuestionResponseDto>> {
    const data = await this.service.update(id, dto);
    return { messageKey: 'success.onboarding_question.updated', data };
  }

  @Patch(':id/active')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary:
      'Toggle is_active. Activating assigns next-free position; deactivating clears position and compacts remaining.',
  })
  public async setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveFlagDto,
  ): Promise<ITranslatedPayload<OnboardingQuestionResponseDto>> {
    const data = await this.service.setActive(id, dto.value);
    return { messageKey: 'success.onboarding_question.active_updated', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary:
      'Soft-delete an onboarding question. If active, the remaining active set is compacted.',
  })
  public async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ITranslatedPayload<null>> {
    await this.service.softDelete(id);
    return { messageKey: 'success.onboarding_question.deleted', data: null };
  }

  @Post('reorder')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_MODERATE)
  @ApiOperation({
    summary:
      'Bulk reorder the active set. Body must list every active question id exactly once. Inactive ids are rejected.',
  })
  public async reorder(
    @Body() dto: ReorderOnboardingQuestionsDto,
  ): Promise<ITranslatedPayload<OnboardingQuestionResponseDto[]>> {
    const data = await this.service.reorder(dto);
    return { messageKey: 'success.onboarding_question.reordered', data };
  }
}
