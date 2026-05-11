import { Auditable, AuditableEntity } from '@database/entities/base/auditable.entity';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ContactTopic = 'sales' | 'partnership' | 'press' | 'other';
export type ContactInquiryStatus = 'received' | 'replied' | 'archived';
export type ContactEmailStatus =
  | 'pending'
  | 'sent'
  | 'failed_notification'
  | 'failed_acknowledgement'
  | 'failed_both';

@Auditable()
@Entity('contact_inquiries')
@Index('idx_contact_inquiries_created', ['createdAt'])
@Index('idx_contact_inquiries_email_status', ['emailStatus'], {
  where: `"email_status" <> 'sent'`,
})
export class ContactInquiry extends AuditableEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_contact_inquiries' })
  public readonly id!: string;

  @Column({ type: 'varchar', length: 120 })
  public name!: string;

  @Column({ type: 'varchar', length: 254 })
  public email!: string;

  @Column({ type: 'varchar', length: 200 })
  public company!: string;

  @Column({ type: 'varchar', length: 20 })
  public topic!: ContactTopic;

  @Column({ type: 'text' })
  public message!: string;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'received' })
  public status!: ContactInquiryStatus;

  @Column({ name: 'email_status', type: 'varchar', length: 30, default: 'pending' })
  public emailStatus!: ContactEmailStatus;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  public ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  public userAgent!: string | null;
}
