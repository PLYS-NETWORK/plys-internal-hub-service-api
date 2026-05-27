import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexes20260527000001 implements MigrationInterface {
  public readonly name = 'PerformanceIndexes20260527000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_kanban
      ON tasks (assigned_to, kanban_status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_consultant_txn_consultant_created
      ON consultant_transactions (consultant_id, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_consultant_txn_type_status_created
      ON consultant_transactions (type, status, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_consultant_txn_consultant_type_created
      ON consultant_transactions (consultant_id, type, created_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_status_notified
      ON invoices (status, notified_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoices_status_notified`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_consultant_txn_consultant_type_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_consultant_txn_type_status_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_consultant_txn_consultant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_assigned_kanban`);
  }
}
