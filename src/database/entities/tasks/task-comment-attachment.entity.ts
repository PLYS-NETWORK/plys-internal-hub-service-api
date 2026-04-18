import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TaskComment } from './task-comment.entity';

// Metadata only — actual files live in object storage (S3/R2).
@Entity('task_comment_attachments')
export class TaskCommentAttachment {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_task_comment_attachments',
  })
  public readonly id!: string;

  @Column({ name: 'comment_id', type: 'uuid' })
  public commentId!: string;

  @ManyToOne(() => TaskComment, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'comment_id',
    foreignKeyConstraintName: 'fk_task_comment_attachments_to_task_comments',
  })
  public comment!: TaskComment;

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
