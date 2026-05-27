import { User } from '@plys/libraries/database/entities/auth/user.entity';
import {
  Auditable,
  AuditableEntity,
} from '@plys/libraries/database/entities/base/auditable.entity';
import { FileStorageProvider } from '@plys/libraries/database/enums';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// Tracks every uploaded file along with its storage location, owner, and
// audit metadata. The storage_provider column records which backend holds
// the bytes so a row written under one provider is still locatable after a
// default switch — see FilesService.getById / FilesCleanupService.
@Auditable()
@Entity('files')
@Index('uq_files_storage_key', ['storageKey'], { unique: true })
@Index('idx_files_owner_user_id', ['ownerUserId'])
@Index('idx_files_purpose', ['purpose'])
@Index('idx_files_deleted_at', ['deletedAt'])
export class FileEntity extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_files' })
  public readonly id!: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  public ownerUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id', foreignKeyConstraintName: 'fk_files_to_users' })
  public ownerUser!: User;

  @Column({ name: 'storage_provider', type: 'varchar', length: 16 })
  public storageProvider!: FileStorageProvider;

  // Cloud keys can exceed 255 chars; `text` keeps headroom. Uniqueness is
  // enforced via the named class-level @Index above (uq_files_storage_key)
  // so the same physical object is never double-tracked.
  @Column({ name: 'storage_key', type: 'text' })
  public storageKey!: string;

  // Sanitised client-supplied name for display only; never used as a path.
  @Column({ name: 'original_name', type: 'text' })
  public originalName!: string;

  // RFC 6838 caps mime length at 127. Always sniffed via magic bytes —
  // never trust the client's Content-Type header.
  @Column({ name: 'mime_type', type: 'varchar', length: 127 })
  public mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  public sizeBytes!: number;

  // Hex sha256 of the bytes; useful for dedup and integrity verification.
  @Column({ type: 'char', length: 64, nullable: true })
  public sha256!: string | null;

  // Optional caller-supplied tag (e.g. `avatar`, `project_attachment`).
  @Column({ type: 'varchar', length: 64, nullable: true })
  public purpose!: string | null;
}
