import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills `files.purpose` for currently-attached rows.
 *
 * The new contract (server-managed `purpose`) makes `purpose IS NULL` the
 * authoritative reclaim predicate for the orphan-cleanup cron. Before this
 * migration every existing attached file has `purpose = NULL` and would
 * survive only by virtue of the LEFT-JOIN safety net in
 * `FilesCleanupService.purgeOrphanedUploads`. This migration tags those
 * rows with the surface that owns them so the contract is truthful from
 * day one.
 *
 * Idempotent — running twice is a no-op because of the `purpose IS NULL`
 * predicate. Down migration is intentionally empty: clearing purpose
 * would let the cron reclaim live attachments.
 */
export class BackfillFilesPurpose20260501000003 implements MigrationInterface {
  public readonly name = 'BackfillFilesPurpose20260501000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE files f
         SET purpose = 'task_comment'
        FROM task_comment_attachments tca
       WHERE tca.file_id = f.id
         AND f.purpose IS NULL
    `);

    await queryRunner.query(`
      UPDATE files f
         SET purpose = 'task_evidence'
        FROM task_evidence_attachments tea
       WHERE tea.file_id = f.id
         AND f.purpose IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Intentional no-op — see class JSDoc.
  }
}
