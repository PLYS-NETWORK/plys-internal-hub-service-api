import { User } from '@plys/libraries/database/entities/auth/user.entity';
import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { TaskReviewDecision } from '@plys/libraries/database/enums';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Task } from './task.entity';

// One vote cast by an internal reviewer (`UserRole.TASK_REVIEWER`) on a task
// submitted to IN_REVIEW. Three reviewers ("3+1" model) participate per round:
//
//   - 2 initial reviewers are auto-assigned when the task enters IN_REVIEW.
//   - If they disagree (1 PASS + 1 FAIL), an Arbiter (3rd reviewer) is assigned
//     and the outcome is ALWAYS REVISION_REQUESTED regardless of the Arbiter's
//     vote — they only supply the final feedback narrative.
//   - If both initial votes agree on PASS, the AI quality check runs next.
//
// `round_number` matches `tasks.last_review_round`. Reviewers may legitimately
// appear in multiple rounds for the same task, so the uniqueness key includes
// the round.
@Auditable()
@Entity('task_reviews')
@Unique('uq_task_reviews_task_reviewer_round', ['taskId', 'reviewerId', 'roundNumber'])
@Index('idx_task_reviews_task_round_decision', ['taskId', 'roundNumber', 'decision'])
@Index('idx_task_reviews_reviewer_decision', ['reviewerId', 'decision'])
export class TaskReview extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_task_reviews' })
  public readonly id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  public taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_task_reviews_to_tasks',
  })
  public task!: Task;

  @Column({ name: 'reviewer_id', type: 'uuid' })
  public reviewerId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'reviewer_id',
    foreignKeyConstraintName: 'fk_task_reviews_to_users',
  })
  public reviewer!: User;

  @Column({ name: 'round_number', type: 'int' })
  public roundNumber!: number;

  @Column({
    type: 'varchar',
    length: 15,
    default: TaskReviewDecision.PENDING,
  })
  public decision!: TaskReviewDecision;

  // True when the reviewer was brought in as the tie-breaker for a 1-1 split.
  // The Arbiter's vote does not change the outcome (always REVISION_REQUESTED),
  // it only contributes to the consolidated feedback shown to the consultant.
  @Column({ name: 'is_arbiter', type: 'boolean', default: false })
  public isArbiter!: boolean;

  @Column({ type: 'text', nullable: true })
  public feedback!: string | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'NOW()' })
  public assignedAt!: Date;

  @Column({ name: 'voted_at', type: 'timestamptz', nullable: true })
  public votedAt!: Date | null;
}
