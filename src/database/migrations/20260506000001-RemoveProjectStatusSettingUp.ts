import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collapses the `setting_up` project status into `draft`. The intermediate
 * state has been dropped from the application enum because the new auto-status
 * rule treats any missing completeness signal (drafts / skills / consultants)
 * as `draft` — there is no longer a meaningful in-between.
 *
 * Backfill is irreversible: the down migration cannot recover which `draft`
 * rows used to be `setting_up`, so it intentionally throws.
 */
export class RemoveProjectStatusSettingUp20260506000001 implements MigrationInterface {
  public readonly name = 'RemoveProjectStatusSettingUp20260506000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "projects" SET "status" = 'draft' WHERE "status" = 'setting_up'
    `);
  }

  public async down(): Promise<void> {
    throw new Error(
      'RemoveProjectStatusSettingUp20260506000001 is irreversible: the original `setting_up` rows cannot be reconstructed from `draft`.',
    );
  }
}
