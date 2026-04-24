import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import {
  AssignTaskDto,
  CreateTaskDto,
  ReorderTasksDto,
  UpdateTaskBusinessStatusDto,
  UpdateTaskConsultantStatusDto,
} from '../dto/requests';
import { ConsultantTaskResponseDto, TaskResponseDto } from '../dto/responses';

export interface ITaskOperationsService {
  createDraftTask(dto: CreateTaskDto): Promise<TaskResponseDto>;
  updateBusinessStatus(taskId: string, dto: UpdateTaskBusinessStatusDto): Promise<TaskResponseDto>;
  updateConsultantStatus(
    taskId: string,
    dto: UpdateTaskConsultantStatusDto,
  ): Promise<TaskResponseDto>;
  claimTask(taskId: string): Promise<TaskResponseDto>;
  assignTask(taskId: string, dto: AssignTaskDto): Promise<TaskResponseDto>;
  listProjectTasks(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskResponseDto>>;
  reorderTasks(dto: ReorderTasksDto): Promise<void>;
  listProjectTasksForConsultant(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ConsultantTaskResponseDto>>;
}
