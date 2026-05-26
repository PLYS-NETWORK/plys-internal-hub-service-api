import { ChatMessageRole } from '@plys/libraries/database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { ProjectChatSession } from './project-chat-session.entity';

// Append-only message log for a project_chat_session. Pagination cursor is
// `seq` (per-session monotonic ordinal allocated inside the same tx as the
// insert) so newest-first reads are an index-only scan on
// (session_id, seq DESC) without millisecond-tie ambiguity.
//
// Deliberately not @Auditable — these rows are immutable; createdAt is the
// only timestamp that matters and TypeORM emits it via the column default.
@Entity('chat_message')
@Index('uq_chat_message_session_seq', ['sessionId', 'seq'], { unique: true })
@Index('idx_chat_message_session_seq_desc', ['sessionId', 'seq'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_chat_message' })
  public readonly id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  public sessionId!: string;

  @ManyToOne(() => ProjectChatSession, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'session_id',
    foreignKeyConstraintName: 'fk_chat_message_to_project_chat_session',
  })
  public session!: ProjectChatSession;

  // Per-session monotonic ordinal. Allocated inside the same tx as the
  // insert (the surrounding code locks the session row), so concurrent
  // appends from two devices serialise. Source of truth for pagination.
  @Column({ type: 'int' })
  public seq!: number;

  @Column({ type: 'varchar', length: 20 })
  public role!: ChatMessageRole;

  // Vercel AI SDK UIMessage `parts` — array of typed segments (text, tool
  // calls, etc.). Stored verbatim so the FE can rehydrate without lossy
  // shape transforms.
  @Column({ type: 'jsonb' })
  public parts!: unknown;

  // Optional metadata the AI SDK attaches (tool-call IDs, citations, etc.).
  @Column({ type: 'jsonb', nullable: true })
  public metadata!: Record<string, unknown> | null;

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  public readonly createdAt!: Date;
}
