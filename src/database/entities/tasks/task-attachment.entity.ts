import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { FileEntity } from '@database/entities/files/file.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Task } from './task.entity';

// Task-level attachment snapshot (briefs, references, supporting documents
// uploaded by the business owner). Distinct from `task_result_attachments`,
// which belong to a consultant-submitted result row.
//
// The metadata (name/url/mime/size) is snapshotted at attachment time so the
// listing stays durable even if the source `files` row is later removed.
// `file_id` keeps the audit chain to the canonical file row when available.
@Auditable()
@Entity('task_attachments')
@Index('idx_task_attachments_task_id', ['taskId'])
export class TaskAttachment extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_task_attachments',
  })
  public readonly id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  public taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'fk_task_attachments_to_tasks',
  })
  public task!: Task;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  public fileId!: string | null;

  @ManyToOne(() => FileEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'file_id',
    foreignKeyConstraintName: 'fk_task_attachments_to_files',
  })
  public file!: FileEntity | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  public fileName!: string;

  @Column({ name: 'file_url', type: 'text' })
  public fileUrl!: string;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  public fileSizeBytes!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  public mimeType!: string | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  public readonly uploadedAt!: Date;
}
