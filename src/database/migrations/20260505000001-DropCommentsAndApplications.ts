import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the application/interview/comment surface from the schema.
 *
 * Tables dropped:
 *   - task_comment_attachments, task_comments
 *   - interview_answers
 *   - project_applications, project_interview_questions
 *
 * project_members is preserved (it is the consultant↔project link), but its
 * `application_id` FK + column is dropped because applications no longer
 * exist.
 *
 * `down()` is intentionally irreversible — the source-of-truth schema for
 * these features has been deleted from the codebase.
 */
export class DropCommentsAndApplications20260505000001 implements MigrationInterface {
  public readonly name = 'DropCommentsAndApplications20260505000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Comments + their attachments — children first.
    await queryRunner.query(`DROP TABLE IF EXISTS "task_comment_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_comments" CASCADE`);

    // Interview answers reference both project_applications and
    // project_interview_questions — drop them before either parent.
    await queryRunner.query(`DROP TABLE IF EXISTS "interview_answers" CASCADE`);

    // project_members keeps the FK to project_applications via application_id.
    // Drop the constraint and column before the parent table goes.
    await queryRunner.query(`
      ALTER TABLE "project_members"
        DROP CONSTRAINT IF EXISTS "fk_project_members_to_project_applications"
    `);
    await queryRunner.query(`ALTER TABLE "project_members" DROP COLUMN IF EXISTS "application_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "project_applications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_interview_questions" CASCADE`);
  }

  public async down(): Promise<void> {
    throw new Error('DropCommentsAndApplications is irreversible.');
  }
}
