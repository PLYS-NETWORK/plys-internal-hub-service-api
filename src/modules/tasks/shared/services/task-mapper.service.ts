import {
  Task,
  TaskComment,
  TaskEvidence,
  TaskEvidenceAttachment,
  TaskHistory,
} from '@database/entities';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  ConsultantTaskResponseDto,
  TaskCommentResponseDto,
  TaskEvidenceAttachmentResponseDto,
  TaskEvidenceResponseDto,
  TaskHistoryResponseDto,
  TaskResponseDto,
} from '../../dto/responses';
import { ITaskMapperService } from '../interfaces/task-mapper.service.interface';

@Injectable()
export class TaskMapperService implements ITaskMapperService {
  /** @inheritdoc */
  public toTaskResponseDto(task: Task): TaskResponseDto {
    return plainToInstance(
      TaskResponseDto,
      {
        id: task.id,
        project_id: task.projectId,
        title: task.title,
        description: task.description,
        price: task.price,
        platform_fee_amount: task.platformFeeAmount,
        consultant_payout: task.consultantPayout,
        difficulty_level: task.difficultyLevel,
        kanban_status: task.kanbanStatus,
        assigned_to: task.assignedTo,
        assigned_at: task.assignedAt,
        approved_by: task.approvedBy,
        approved_at: task.approvedAt,
        display_order: task.displayOrder,
        created_at: task.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public toConsultantTaskResponseDto(task: Task): ConsultantTaskResponseDto {
    return plainToInstance(
      ConsultantTaskResponseDto,
      {
        id: task.id,
        project_id: task.projectId,
        title: task.title,
        description: task.description,
        difficulty_level: task.difficultyLevel,
        kanban_status: task.kanbanStatus,
        assigned_to: task.assignedTo,
        assigned_at: task.assignedAt,
        display_order: task.displayOrder,
        created_at: task.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public toTaskHistoryResponseDto(history: TaskHistory): TaskHistoryResponseDto {
    return plainToInstance(
      TaskHistoryResponseDto,
      {
        id: history.id,
        task_id: history.taskId,
        change_type: history.changeType,
        previous_kanban_status: history.previousKanbanStatus,
        new_kanban_status: history.newKanbanStatus,
        previous_assigned_to: history.previousAssignedTo,
        new_assigned_to: history.newAssignedTo,
        changed_by: history.changedBy,
        note: history.note,
        changed_at: history.changedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public toTaskCommentResponseDto(entity: TaskComment): TaskCommentResponseDto {
    return plainToInstance(
      TaskCommentResponseDto,
      {
        id: entity.id,
        task_id: entity.taskId,
        author_id: entity.authorId,
        comment: entity.comment,
        is_edited: entity.isEdited,
        edited_at: entity.editedAt,
        created_at: entity.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public toTaskEvidenceResponseDto(
    evidence: TaskEvidence,
    attachments: TaskEvidenceAttachment[],
  ): TaskEvidenceResponseDto {
    return plainToInstance(
      TaskEvidenceResponseDto,
      {
        id: evidence.id,
        task_id: evidence.taskId,
        author_id: evidence.authorId,
        remarks: evidence.remarks,
        is_edited: evidence.isEdited,
        edited_at: evidence.editedAt,
        created_at: evidence.createdAt,
        attachments: attachments.map((a) => this.toTaskEvidenceAttachmentPlain(a)),
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public toTaskEvidenceAttachmentResponseDto(
    attachment: TaskEvidenceAttachment,
  ): TaskEvidenceAttachmentResponseDto {
    return plainToInstance(
      TaskEvidenceAttachmentResponseDto,
      this.toTaskEvidenceAttachmentPlain(attachment),
      { excludeExtraneousValues: true },
    );
  }

  // bigint columns come back as strings from the pg driver — coerce here so
  // clients see a real number.
  private toTaskEvidenceAttachmentPlain(attachment: TaskEvidenceAttachment): {
    id: string;
    file_id: string | null;
    file_name: string;
    file_url: string;
    mime_type: string | null;
    file_size_bytes: number | null;
    uploaded_at: Date;
  } {
    return {
      id: attachment.id,
      file_id: attachment.fileId,
      file_name: attachment.fileName,
      file_url: attachment.fileUrl,
      mime_type: attachment.mimeType,
      file_size_bytes: attachment.fileSizeBytes === null ? null : Number(attachment.fileSizeBytes),
      uploaded_at: attachment.uploadedAt,
    };
  }
}
