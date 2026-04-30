import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameProjectStatusPublicToPublished20260430000002 implements MigrationInterface {
  public readonly name = 'RenameProjectStatusPublicToPublished20260430000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The status column is plain VARCHAR(20) — no enum type or CHECK constraint
    // to recreate. Just rewrite the value in place.
    await queryRunner.query(
      `UPDATE "projects" SET "status" = 'published' WHERE "status" = 'public'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "projects" SET "status" = 'public' WHERE "status" = 'published'`,
    );
  }
}
