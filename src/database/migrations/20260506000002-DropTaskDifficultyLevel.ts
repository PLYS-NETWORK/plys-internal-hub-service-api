import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the `tasks.difficulty_level` column. The application never reads,
 * filters, or aggregates by difficulty — it only stored what the create DTO
 * accepted — so the column was pure write-only churn. The accompanying enum
 * `TaskDifficulty` is also removed from the codebase.
 *
 * Down migration recreates the column with its original default so a rollback
 * is possible, but the prior per-row values are unrecoverable.
 */
export class DropTaskDifficultyLevel20260506000002 implements MigrationInterface {
  public readonly name = 'DropTaskDifficultyLevel20260506000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "difficulty_level"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN "difficulty_level" VARCHAR(20) NOT NULL DEFAULT 'medium'`,
    );
  }
}
