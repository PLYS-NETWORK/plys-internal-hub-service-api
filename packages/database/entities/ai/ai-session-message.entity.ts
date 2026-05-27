import {
  Traceable,
  TraceableEntity,
} from '@plys/libraries/database/entities/base/traceable.entity';
import { Task } from '@plys/libraries/database/entities/tasks/task.entity';
import { AiMessageRole } from '@plys/libraries/database/enums';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { AiTaskSession } from './ai-task-session.entity';

// Append-only conversation log. Optional `linked_task_id` connects a message
// to the task it produced. `message_order` is uniquely scoped to a session
// (§M4 fix — was previously only soft-ordered).
@Traceable()
@Entity('ai_session_messages')
@Unique('uq_ai_session_messages_session_order', ['sessionId', 'messageOrder'])
@Index('idx_ai_messages_session_order', ['sessionId', 'messageOrder'])
export class AiSessionMessage extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_ai_session_messages' })
  public readonly id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  public sessionId!: string;

  @ManyToOne(() => AiTaskSession, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'session_id',
    foreignKeyConstraintName: 'fk_ai_session_messages_to_ai_task_sessions',
  })
  public session!: AiTaskSession;

  @Column({ type: 'varchar', length: 10 })
  public role!: AiMessageRole;

  @Column({ type: 'text' })
  public content!: string;

  @Column({ name: 'linked_task_id', type: 'uuid', nullable: true })
  public linkedTaskId!: string | null;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'linked_task_id',
    foreignKeyConstraintName: 'fk_ai_session_messages_to_tasks',
  })
  public linkedTask!: Task | null;

  @Column({ name: 'token_count', type: 'int', nullable: true })
  public tokenCount!: number | null;

  @Column({ name: 'message_order', type: 'int' })
  public messageOrder!: number;
}
