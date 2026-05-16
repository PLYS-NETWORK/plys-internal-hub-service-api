import { AbstractRepository } from '@common/repositories';
import { TaskDispute } from '@database/entities';
import { TaskDisputeStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IBusinessDisputeRow, ITaskDisputeRepository } from './interfaces';

@Injectable()
export class TaskDisputeRepository
  extends AbstractRepository<TaskDispute>
  implements ITaskDisputeRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskDispute, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskDisputeRepository(manager) as this;
  }

  /** @inheritdoc */
  public async countOpen(): Promise<number> {
    return this.repository.count({ where: { status: TaskDisputeStatus.OPEN } });
  }

  /** @inheritdoc */
  public async countOpenByBusinessId(businessId: string): Promise<number> {
    const row = await this.createQueryBuilder('td')
      .innerJoin('td.task', 'task')
      .innerJoin('task.project', 'project')
      .select('COUNT(*)', 'count')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL')
      .andWhere('td.status = :status', { status: TaskDisputeStatus.OPEN })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async findOpenByBusinessId(
    businessId: string,
    limit: number,
  ): Promise<IBusinessDisputeRow[]> {
    const rows = await this.createQueryBuilder('td')
      .innerJoin('td.task', 'task')
      .innerJoin('task.project', 'project')
      .select('td.id', 'dispute_id')
      .addSelect('task.id', 'task_id')
      .addSelect('task.code', 'task_code')
      .addSelect('LEFT(td.reason, 120)', 'reason_snippet')
      .addSelect('td.opened_at', 'opened_at')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL')
      .andWhere('td.status = :status', { status: TaskDisputeStatus.OPEN })
      .orderBy('td.opened_at', 'ASC')
      .limit(limit)
      .getRawMany<{
        dispute_id: string;
        task_id: string;
        task_code: string;
        reason_snippet: string;
        opened_at: Date;
      }>();
    return rows;
  }
}
