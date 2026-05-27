import { User } from '@plys/libraries/database/entities/auth/user.entity';
import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { ChatSessionMode, ChatSessionStatus } from '@plys/libraries/database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Project } from './project.entity';

// One conversation between a business user and the AI project planner.
// Replaces the older ai_task_sessions/ai_session_messages pair for the new
// chat surface — multiple sessions per (project, user) are allowed (no unique
// constraint on the pair) so the FE picker can show planning history.
//
// `messages` are NOT stored here; they live in chat_message rows for cheap
// pagination. `message_count` is denormalised on this row and kept in sync
// inside the same transaction as the inserts, so callers don't need to count
// the child table on every read.
@Auditable()
@Entity('project_chat_session')
@Index('idx_project_chat_session_project_user_updated', ['projectId', 'userId', 'updatedAt'])
export class ProjectChatSession extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_project_chat_session' })
  public readonly id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  public projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'project_id',
    foreignKeyConstraintName: 'fk_project_chat_session_to_projects',
  })
  public project!: Project;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_project_chat_session_to_users',
  })
  public user!: User;

  @Column({ type: 'varchar', length: 15 })
  public mode!: ChatSessionMode;

  // Optional FE-driven sub-state for PLANNING flow (e.g. ANALYZE / TASK_REVIEW).
  // The BE never gates on it — purely a stash so the FE can resume mid-flow.
  @Column({ type: 'varchar', length: 30, nullable: true })
  public stage!: string | null;

  @Column({ type: 'varchar', length: 160 })
  public title!: string;

  @Column({ type: 'varchar', length: 15, default: ChatSessionStatus.ACTIVE })
  public status!: ChatSessionStatus;

  // Free-form FE working state (current draft, partial inputs, etc.).
  // Replaced wholesale on PATCH /chat-sessions/:id; never read by the BE.
  @Column({ type: 'jsonb', default: {} })
  public draft!: Record<string, unknown>;

  // Denormalised counter — incremented inside the same tx as chat_message
  // inserts so a session row read avoids an aggregate on the child table.
  @Column({ name: 'message_count', type: 'int', default: 0 })
  public messageCount!: number;

  // Set when the FE marks the session `completed` after a successful
  // ai-sync apply; null otherwise (including for `abandoned` sessions).
  @Column({ name: 'implemented_at', type: 'timestamptz', nullable: true })
  public implementedAt!: Date | null;

  // Tasks the FE created via the AI runner from this session. Stored as a
  // JSONB array of UUIDs. Audit / forensic field — never used by the BE for
  // reasoning.
  @Column({ name: 'created_task_ids', type: 'jsonb', nullable: true })
  public createdTaskIds!: string[] | null;
}
