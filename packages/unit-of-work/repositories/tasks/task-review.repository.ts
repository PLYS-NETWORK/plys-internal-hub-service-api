import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { TaskReview } from '@plys/libraries/database/entities';
import { TaskReviewDecision } from '@plys/libraries/database/enums';
import { EntityManager } from 'typeorm';

import {
  ICreateTaskReviewRow,
  ITaskReviewDecisionTally,
  ITaskReviewRepository,
} from './interfaces';

@Injectable()
export class TaskReviewRepository
  extends AbstractRepository<TaskReview>
  implements ITaskReviewRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(TaskReview, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskReviewRepository(manager) as this;
  }

  /** @inheritdoc */
  public async createBatch(rows: ICreateTaskReviewRow[]): Promise<TaskReview[]> {
    if (rows.length === 0) return [];
    const entities = rows.map((row) =>
      this.repository.create({
        taskId: row.taskId,
        reviewerId: row.reviewerId,
        roundNumber: row.roundNumber,
        isArbiter: row.isArbiter,
        decision: TaskReviewDecision.PENDING,
      }),
    );
    return this.repository.save(entities);
  }

  /** @inheritdoc */
  public async findByTaskAndRound(taskId: string, roundNumber: number): Promise<TaskReview[]> {
    return this.repository.find({
      where: { taskId, roundNumber },
      order: { assignedAt: 'ASC' },
    });
  }

  /** @inheritdoc */
  public async findPendingByReviewerId(
    reviewerId: string,
    page: number,
    take: number,
  ): Promise<{ rows: TaskReview[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeTake = Math.min(100, Math.max(1, take));
    const [rows, total] = await this.createQueryBuilder('tr')
      .innerJoinAndSelect('tr.task', 'task')
      .where('tr.reviewer_id = :reviewerId', { reviewerId })
      .andWhere('tr.decision = :decision', { decision: TaskReviewDecision.PENDING })
      .andWhere('tr.deleted_at IS NULL')
      .orderBy('tr.assigned_at', 'ASC')
      .skip((safePage - 1) * safeTake)
      .take(safeTake)
      .getManyAndCount();
    return { rows, total };
  }

  /** @inheritdoc */
  public async findByIdWithLock(reviewId: string): Promise<TaskReview | null> {
    const row = await this.createQueryBuilder('tr')
      .where('tr.id = :reviewId', { reviewId })
      .andWhere('tr.deleted_at IS NULL')
      .setLock('pessimistic_write')
      .getOne();
    return row ?? null;
  }

  /** @inheritdoc */
  public async findByIdWithTask(reviewId: string): Promise<TaskReview | null> {
    const row = await this.createQueryBuilder('tr')
      .innerJoinAndSelect('tr.task', 'task')
      .leftJoinAndSelect('tr.reviewer', 'reviewer')
      .where('tr.id = :reviewId', { reviewId })
      .andWhere('tr.deleted_at IS NULL')
      .getOne();
    return row ?? null;
  }

  /** @inheritdoc */
  public async recordVote(
    reviewId: string,
    decision: TaskReviewDecision,
    feedback: string | null,
  ): Promise<TaskReview> {
    await this.repository.update({ id: reviewId }, { decision, feedback, votedAt: new Date() });
    const updated = await this.repository.findOne({ where: { id: reviewId } });
    if (!updated) {
      throw new Error(`TaskReview ${reviewId} not found after recordVote`);
    }
    return updated;
  }

  /** @inheritdoc */
  public async tallyDecisions(
    taskId: string,
    roundNumber: number,
  ): Promise<ITaskReviewDecisionTally> {
    const rows = await this.createQueryBuilder('tr')
      .select('tr.decision', 'decision')
      .addSelect('COUNT(*)', 'count')
      .where('tr.task_id = :taskId', { taskId })
      .andWhere('tr.round_number = :roundNumber', { roundNumber })
      .andWhere('tr.deleted_at IS NULL')
      .groupBy('tr.decision')
      .getRawMany<{ decision: TaskReviewDecision; count: string }>();

    const tally: ITaskReviewDecisionTally = { pass: 0, fail: 0, pending: 0, recused: 0 };
    for (const row of rows) {
      const value = Number(row.count);
      if (row.decision === TaskReviewDecision.PASS) tally.pass = value;
      else if (row.decision === TaskReviewDecision.FAIL) tally.fail = value;
      else if (row.decision === TaskReviewDecision.PENDING) tally.pending = value;
      else if (row.decision === TaskReviewDecision.RECUSED) tally.recused = value;
    }
    return tally;
  }

  /** @inheritdoc */
  public async voidPendingByTaskAndRound(taskId: string, roundNumber: number): Promise<number> {
    const result = await this.createQueryBuilder()
      .update()
      .set({ decision: TaskReviewDecision.VOIDED })
      .where('task_id = :taskId', { taskId })
      .andWhere('round_number = :roundNumber', { roundNumber })
      .andWhere('decision = :pending', { pending: TaskReviewDecision.PENDING })
      .execute();
    return result.affected ?? 0;
  }
}
