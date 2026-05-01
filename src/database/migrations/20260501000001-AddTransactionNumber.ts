import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the human-facing `transaction_number` column to both ledgers.
 *
 * Format: `[PLS|LN][SHORT_TYPE][YYYYMMDD][N]` — four segments concatenated
 * with no separator (e.g. `PLSWD202605017`). Existing rows are backfilled
 * deterministically by `(created_at, id)` ordering, partitioned per UTC day,
 * so re-running this migration in staging yields identical numbers.
 */
export class AddTransactionNumber20260501000001 implements MigrationInterface {
  public readonly name = 'AddTransactionNumber20260501000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── business_transactions ─────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "business_transactions" ADD COLUMN "transaction_number" VARCHAR(32) NULL`,
    );

    // Backfill — keep the abbrev CASE in sync with `BUSINESS_TXN_TYPE_ABBREV`
    // in src/database/enums/finance/transaction-number-abbrev.ts.
    await queryRunner.query(`
      WITH numbered AS (
        SELECT id,
               to_char(created_at AT TIME ZONE 'UTC', 'YYYYMMDD') AS day,
               CASE type
                 WHEN 'top_up'            THEN 'TOP'
                 WHEN 'withdraw'          THEN 'WD'
                 WHEN 'refund'            THEN 'REF'
                 WHEN 'project_published' THEN 'PUB'
                 WHEN 'task_added'        THEN 'TSK'
                 WHEN 'monthly_billing'   THEN 'BIL'
               END AS abbrev,
               ROW_NUMBER() OVER (
                 PARTITION BY date_trunc('day', created_at AT TIME ZONE 'UTC')
                 ORDER BY created_at, id
               ) AS rn
          FROM business_transactions
      )
      UPDATE business_transactions bt
         SET transaction_number = 'PLS' || n.abbrev || n.day || n.rn::text
        FROM numbered n
       WHERE n.id = bt.id
    `);

    await queryRunner.query(
      `ALTER TABLE "business_transactions" ALTER COLUMN "transaction_number" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_business_transactions_number" ON "business_transactions" ("transaction_number")`,
    );

    // ─── consultant_transactions ───────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "consultant_transactions" ADD COLUMN "transaction_number" VARCHAR(32) NULL`,
    );

    await queryRunner.query(`
      WITH numbered AS (
        SELECT id,
               to_char(created_at AT TIME ZONE 'UTC', 'YYYYMMDD') AS day,
               CASE type
                 WHEN 'credit_pending' THEN 'CRP'
                 WHEN 'credit_cleared' THEN 'CRC'
                 WHEN 'debit_pending'  THEN 'DBP'
                 WHEN 'withdrawal'     THEN 'WD'
                 WHEN 'reversal'       THEN 'REV'
               END AS abbrev,
               ROW_NUMBER() OVER (
                 PARTITION BY date_trunc('day', created_at AT TIME ZONE 'UTC')
                 ORDER BY created_at, id
               ) AS rn
          FROM consultant_transactions
      )
      UPDATE consultant_transactions ct
         SET transaction_number = 'LN' || n.abbrev || n.day || n.rn::text
        FROM numbered n
       WHERE n.id = ct.id
    `);

    await queryRunner.query(
      `ALTER TABLE "consultant_transactions" ALTER COLUMN "transaction_number" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_consultant_transactions_number" ON "consultant_transactions" ("transaction_number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_consultant_transactions_number"`);
    await queryRunner.query(
      `ALTER TABLE "consultant_transactions" DROP COLUMN IF EXISTS "transaction_number"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_business_transactions_number"`);
    await queryRunner.query(
      `ALTER TABLE "business_transactions" DROP COLUMN IF EXISTS "transaction_number"`,
    );
  }
}
