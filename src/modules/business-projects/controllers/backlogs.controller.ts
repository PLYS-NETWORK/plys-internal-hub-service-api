import { IdempotencyKey } from '@common/decorators/idempotency-key.decorator';
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

import {
  CreateDraftTaskDto,
  ListDraftTasksDto,
  TaskIdsDto,
  UpdateDraftTaskDto,
} from '../dto/requests';
import {
  AddToBoardValidationResponseDto,
  DraftTaskResponseDto,
  PayTasksResponseDto,
} from '../dto/responses';
import { BacklogsService } from '../services/backlogs.service';

@ApiTags('Business Projects — Backlogs')
@ApiBearerAuth()
@Controller('projects/business/:id/backlogs')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BacklogsController {
  constructor(private readonly backlogsService: BacklogsService) {}

  @Post()
  @IdempotencyKey()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a single draft task',
    description:
      'Side effect: adding the first draft task auto-transitions the project from `draft` to `configured` when `required_skills` and `max_consultants > 0` are already set; otherwise the project stays at `draft` until those signals are present. Idempotent — pass `Idempotency-Key` header to make retries safe.',
  })
  public async createDraftTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDraftTaskDto,
  ): Promise<ITranslatedPayload<DraftTaskResponseDto>> {
    const data = await this.backlogsService.createDraftTask(id, dto);
    return { messageKey: 'success.created', data };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List draft tasks (paginated, optional title keyword)' })
  public async listDraftTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: ListDraftTasksDto,
  ): Promise<ITranslatedPayload<PageDto<DraftTaskResponseDto>>> {
    const data = await this.backlogsService.listDraftTasks(id, dto);
    return { messageKey: 'success.ok', data };
  }

  @Patch(':taskId')
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Partially update a draft task (title, description, price)',
  })
  public async updateDraftTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateDraftTaskDto,
  ): Promise<ITranslatedPayload<DraftTaskResponseDto>> {
    const data = await this.backlogsService.updateDraftTask(id, taskId, dto);
    return { messageKey: 'success.ok', data };
  }

  @Delete()
  @IdempotencyKey()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Hard-delete one or more draft tasks (atomic)',
    description:
      'Side effect: removing the last draft task on a setup-phase project demotes its status back to `draft`.',
  })
  public async bulkDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskIdsDto,
  ): Promise<void> {
    await this.backlogsService.bulkDelete(id, dto);
  }

  @Post('add-to-board')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate moving drafts to the board (no state change, no charge)',
  })
  public async addToBoard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskIdsDto,
  ): Promise<ITranslatedPayload<AddToBoardValidationResponseDto>> {
    const data = await this.backlogsService.addToBoardValidation(id, dto);
    return { messageKey: 'success.ok', data };
  }

  @Post('pay-tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authorise & settle: charge the business and promote drafts to TO_DO',
  })
  public async payTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskIdsDto,
  ): Promise<ITranslatedPayload<PayTasksResponseDto>> {
    const data = await this.backlogsService.payTasks(id, dto);
    return { messageKey: 'success.ok', data };
  }
}
