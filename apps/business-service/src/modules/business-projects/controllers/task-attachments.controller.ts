import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IdempotencyKey } from '@plys/libraries/common-nest/decorators/idempotency-key.decorator';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { AttachFilesDto, UpdateTaskAttachmentDto } from '../dto/requests';
import { TaskAttachmentResponseDto } from '../dto/responses';
import { TaskAttachmentsService } from '../services/task-attachments.service';
@Controller('projects/business/:id/tasks/:taskId/attachments')
export class TaskAttachmentsController {
  constructor(private readonly attachmentsService: TaskAttachmentsService) {}
  @Post()
  @IdempotencyKey()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Attach previously-uploaded files to the task (DRAFT or TO_DO only)',
    description:
      'Two-step flow: upload via `POST /files` first, then submit the returned `file_id`s ' +
      'here. The service snapshots metadata into `task_attachments` and flips the file purpose ' +
      'to `task_attachment`. Allowed while the task is DRAFT or TO_DO; once IN_PROGRESS the ' +
      'business surface is frozen.',
  })
  public async attach(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AttachFilesDto,
  ): Promise<ITranslatedPayload<TaskAttachmentResponseDto[]>> {
    const data = await this.attachmentsService.attach(id, taskId, dto);
    return { messageKey: 'success.task.attachment_created', data };
  }
  @Patch(':attachmentId')
  @IdempotencyKey()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rename an existing task attachment (display name only)' })
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: UpdateTaskAttachmentDto,
  ): Promise<ITranslatedPayload<TaskAttachmentResponseDto>> {
    const data = await this.attachmentsService.update(id, taskId, attachmentId, dto);
    return { messageKey: 'success.task.attachment_updated', data };
  }
  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a task attachment and orphan the underlying file for cleanup',
  })
  public async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<void> {
    await this.attachmentsService.remove(id, taskId, attachmentId);
  }
}
