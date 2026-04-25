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

import { TaskEvidence } from './task-evidence.entity';

// Metadata only — actual files live in object storage (S3/local). The file
// metadata (name/url/mime/size) is snapshotted at creation time so the
// evidence stays durable even if the source `files` row is later removed.
// `file_id` keeps the audit chain to the canonical file row when available.
@Entity('task_evidence_attachments')
@Index('idx_task_evidence_attachments_evidence_id', ['evidenceId'])
export class TaskEvidenceAttachment {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_task_evidence_attachments',
  })
  public readonly id!: string;

  @Column({ name: 'evidence_id', type: 'uuid' })
  public evidenceId!: string;

  @ManyToOne(() => TaskEvidence, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'evidence_id',
    foreignKeyConstraintName: 'fk_task_evidence_attachments_to_task_evidences',
  })
  public evidence!: TaskEvidence;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  public fileId!: string | null;

  @ManyToOne(() => FileEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'file_id',
    foreignKeyConstraintName: 'fk_task_evidence_attachments_to_files',
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
