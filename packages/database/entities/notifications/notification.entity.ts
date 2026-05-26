import { User } from '@plys/libraries/database/entities/auth/user.entity';
import {
  Traceable,
  TraceableEntity,
} from '@plys/libraries/database/entities/base/traceable.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

// Append-only event log for in-app notifications. Title/body are localised
// at write time so the live socket push contains a finished string and the
// FE never re-translates. The `metadata` JSON is typed by `NotificationMetadataMap[type]`
// at the dispatcher layer — see src/modules/notifications/types/notification-metadata.types.ts.
@Traceable()
@Entity('notifications')
@Index('idx_notifications_user_created', ['userId', 'createdAt'])
// Partial index: small + hot. Backs both unread-count and unread-only listing.
@Index('idx_notifications_user_unread', ['userId'], { where: '"is_read" = false' })
@Index('idx_notifications_entity', ['entityType', 'entityId'])
export class Notification extends TraceableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_notifications' })
  public readonly id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_notifications_to_users' })
  public user!: User;

  // Discriminator for the FE-typed union. varchar so we can extend without ALTER TYPE.
  @Column({ type: 'varchar', length: 40 })
  public type!: string;

  @Column({ type: 'varchar', length: 200 })
  public title!: string;

  @Column({ type: 'varchar', length: 500 })
  public body!: string;

  @Column({ type: 'jsonb' })
  public metadata!: Record<string, unknown>;

  @Column({ name: 'entity_type', type: 'varchar', length: 30 })
  public entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 64 })
  public entityId!: string;

  @Column({ name: 'redirect_url', type: 'varchar', length: 1024, nullable: true })
  public redirectUrl!: string | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  public actorId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'fk_notifications_actor_to_users' })
  public actor!: User | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  public isRead!: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  public readAt!: Date | null;
}
