import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the default for `projects.required_consultants` from 1 to 0 so a
 * freshly-created project starts genuinely empty. The auto-status recompute
 * (DRAFT → SETTING_UP → CONFIGURED) treats `> 0` as one of the completeness
 * signals; a default of 1 would cause every new project to bypass SETTING_UP
 * the moment a draft task is added. Existing rows are intentionally not
 * back-filled — they keep whatever value they had.
 */
export class AlterProjectsRequiredConsultantsDefault20260503000001 implements MigrationInterface {
  public readonly name = 'AlterProjectsRequiredConsultantsDefault20260503000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" ALTER COLUMN "required_consultants" SET DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects" ALTER COLUMN "required_consultants" SET DEFAULT 1
    `);
  }
}
