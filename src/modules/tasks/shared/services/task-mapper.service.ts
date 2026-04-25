import { Task, TaskComment, TaskHistory } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  ConsultantTaskResponseDto,
  TaskCommentResponseDto,
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
  public toTaskCommentResponseDto(comment: TaskComment): TaskCommentResponseDto {
    return plainToInstance(
      TaskCommentResponseDto,
      {
        id: comment.id,
        task_id: comment.taskId,
        author_id: comment.authorId,
        body: comment.body,
        is_edited: comment.isEdited,
        edited_at: comment.editedAt,
        created_at: comment.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
