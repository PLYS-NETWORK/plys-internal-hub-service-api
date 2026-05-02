import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `payment_type` to `projects` so the consultant overview can branch
 * between per-task and per-month earnings shapes without inferring from
 * billing-period heuristics. Defaulted to `per_task` for legacy rows; a CHECK
 * constraint mirrors the application-side enum and an index supports the
 * consultant discovery / overview hot path.
 */
export class AddProjectsPaymentType20260502000001 implements MigrationInterface {
  public readonly name = 'AddProjectsPaymentType20260502000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "payment_type" VARCHAR(20) NOT NULL DEFAULT 'per_task'
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD CONSTRAINT "ck_projects_payment_type"
      CHECK ("payment_type" IN ('per_task','per_month'))
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_projects_payment_type" ON "projects" ("payment_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_projects_payment_type"`);
    await queryRunner.query(`
      ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "ck_projects_payment_type"
    `);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "payment_type"`);
  }
}
