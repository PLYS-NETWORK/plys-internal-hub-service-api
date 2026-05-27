import { Column, CreateDateColumn } from 'typeorm';

// TypeScript type contract only — see AuditableEntity for the pattern rationale.
export abstract class TraceableEntity {
  public readonly createdAt!: Date;
  public createdBy!: string | null;
}

// Apply on append-only entities (no update/delete) that only need a creation trace.
export function Traceable(): ClassDecorator {
  return (target) => {
    CreateDateColumn({ name: 'created_at', type: 'timestamptz' })(target.prototype, 'createdAt');
    Column({ name: 'created_by', type: 'uuid', nullable: true })(target.prototype, 'createdBy');
  };
}
