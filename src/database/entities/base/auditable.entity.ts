import { Column, CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

// TypeScript type contract only — no @Column decorators here.
// Column registration is deferred to the @Auditable() class decorator on each
// entity so that TypeORM adds audit columns AFTER the entity's own columns in
// MetadataArgsStorage, which produces the correct column order in the DB table.
export abstract class AuditableEntity {
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;
  public createdBy!: string | null;
  public updatedBy!: string | null;
  public deletedBy!: string | null;
}

// Apply on every @Entity class that should carry full audit columns.
// Class decorators always run after property decorators, so these columns
// appear at the end of the table regardless of decorator stack position.
export function Auditable(): ClassDecorator {
  return (target: Function) => {
    CreateDateColumn({ name: 'created_at', type: 'timestamptz' })(target.prototype, 'createdAt');
    UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })(target.prototype, 'updatedAt');
    DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })(
      target.prototype,
      'deletedAt',
    );
    Column({ name: 'created_by', type: 'uuid', nullable: true })(target.prototype, 'createdBy');
    Column({ name: 'updated_by', type: 'uuid', nullable: true })(target.prototype, 'updatedBy');
    Column({ name: 'deleted_by', type: 'uuid', nullable: true })(target.prototype, 'deletedBy');
  };
}
