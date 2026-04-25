import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Task } from '@database/entities';
import { ProjectMemberStatus, TaskHistoryChangeType } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { TaskHistoryResponseDto } from '../../dto/responses';
import { TASK_ERRORS } from '../constants/task-error-messages.constant';
import {
  IBusinessProfileSnapshot,
  IConsultantProfileSnapshot,
  ITaskAccessService,
} from '../interfaces/task-access.service.interface';
import { TaskMapperService } from './task-mapper.service';

@Injectable()
export class TaskAccessService implements ITaskAccessService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly taskMapper: TaskMapperService,
  ) {
    this.logger = new AppLogger(TaskAccessService.name, requestContext);
  }

  /** @inheritdoc */
  public async resolveBusinessId(): Promise<string> {
    const profile = await this.resolveBusinessProfile();
    return profile.id;
  }

  /** @inheritdoc */
  public async resolveBusinessProfile(): Promise<IBusinessProfileSnapshot> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);
    if (!profile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return profile;
  }

  /** @inheritdoc */
  public async resolveConsultantProfile(): Promise<IConsultantProfileSnapshot> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return profile;
  }

  /** @inheritdoc */
  public async findTaskOwnedByBusiness(taskId: string, businessId: string): Promise<Task> {
    const task = await this.uow.tasks.findOne({
      where: { id: taskId },
      relations: { project: true },
    });

    if (!task || task.project.businessId !== businessId) {
      throw this.taskNotFound(taskId);
    }

    return task;
  }

  /** @inheritdoc */
  public async findTaskOrThrow(taskId: string): Promise<Task> {
    const task = await this.uow.tasks.findOne({ where: { id: taskId } });
    if (!task) {
      throw this.taskNotFound(taskId);
    }
    return task;
  }

  /** @inheritdoc */
  public async verifyProjectMembership(projectId: string, consultantId: string): Promise<void> {
    const member = await this.uow.projectMembers.findOne({
      where: {
        projectId,
        consultantId,
        status: ProjectMemberStatus.ACTIVE,
      },
    });

    if (!member) {
      throw new TranslatableException({
        messageKey: TASK_ERRORS.CONSULTANT_NOT_PROJECT_MEMBER,
        errorCode: ERROR_CODES.TASK_CONSULTANT_NOT_PROJECT_MEMBER,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
  }

  /** @inheritdoc */
  public async getTaskHistory(
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskHistoryResponseDto>> {
    this.logger.log(`getTaskHistory — start | taskId: ${taskId}`);
    await this.findTaskOrThrow(taskId);

    const [rows, itemCount] = await this.uow.taskHistory.findAndCount({
      where: {
        taskId,
        changeType: In([
          TaskHistoryChangeType.STATUS_CHANGE,
          TaskHistoryChangeType.ASSIGNMENT,
          TaskHistoryChangeType.UNASSIGNMENT,
        ]),
      },
      order: { changedAt: 'DESC' },
      skip: pageOptions.skip,
      take: pageOptions.limit,
    });

    const data = rows.map((r) => this.taskMapper.toTaskHistoryResponseDto(r));
    this.logger.log(
      `getTaskHistory — complete | taskId: ${taskId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, new PageMetaDto({ pageOptionsDto: pageOptions, itemCount }));
  }

  /** @inheritdoc */
  public taskNotFound(taskId: string): TranslatableException {
    this.logger.warn(`task operation — task not found | taskId: ${taskId}`);
    return new TranslatableException({
      messageKey: TASK_ERRORS.NOT_FOUND,
      errorCode: ERROR_CODES.TASK_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  /** @inheritdoc */
  public projectNotFound(projectId: string, businessId: string): TranslatableException {
    this.logger.warn(
      `task operation — project not found | projectId: ${projectId}, businessId: ${businessId}`,
    );
    return new TranslatableException({
      messageKey: 'error.project.not_found',
      errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }
}
