import { Column, CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class AuditableEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public readonly createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public readonly updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  public readonly deletedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  public createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  public updatedBy!: string | null;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  public deletedBy!: string | null;
}
