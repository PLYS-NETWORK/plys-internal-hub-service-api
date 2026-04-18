import { Column, CreateDateColumn } from 'typeorm';

export abstract class TraceableEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public readonly createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  public createdBy!: string | null;
}
