import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

// Domain 8 — Finance (billing, wallets, transactions, webhooks)
// Creates: billing_periods, invoices, invoice_line_items, consultant_wallets,
//          wallet_transactions, business_transactions, webhook_events,
//          v_wallet_balance_audit (view), get_or_create_billing_period (function)
// Adds deferred FKs:
//   tasks.billing_period_id → billing_periods.id
//   notifications.ref_invoice_id → invoices.id (§C1 fix)
// Schema fixes applied:
//   §C1   notifications.ref_invoice_id FK added here, not inline in Domain 7
//   §C2   consultant_wallets.cleared_balance has NO >= 0 CHECK (allows reversals)
//   §C4   webhook_events UNIQUE on (processor, event_id), not event_id alone
//   §C8   sync_wallet_balance_on_transaction subtracts total_earned on reversal
//   §M8   invoice_line_items CHECK amount = platform_fee_amount + consultant_payout
export class Domain8Finance1713399100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- billing_periods ----------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'billing_periods',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_billing_periods',
          },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'period_start', type: 'date', isNullable: false },
          { name: 'period_end', type: 'date', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'open'`,
          },
          {
            name: 'total_amount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          { name: 'finalized_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_billing_periods_status',
            expression: `"status" IN ('open','finalized','invoiced','paid','overdue','disputed')`,
          },
          {
            name: 'ck_billing_periods_period_dates_valid',
            expression: `"period_end" >= "period_start"`,
          },
        ],
        uniques: [
          {
            name: 'uq_billing_periods_business_period_start',
            columnNames: ['business_id', 'period_start'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_billing_periods_to_business_profiles',
            columnNames: ['business_id'],
            referencedTableName: 'business_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_billing_periods_business_open" ON "billing_periods" ("business_id", "status") WHERE "status" IN ('open','finalized')`,
    );

    // Deferred FK from Domain 4: tasks.billing_period_id → billing_periods.id
    await queryRunner.query(`
      ALTER TABLE tasks
        ADD CONSTRAINT fk_tasks_to_billing_periods
        FOREIGN KEY (billing_period_id) REFERENCES billing_periods(id) ON DELETE SET NULL
    `);

    // get_or_create_billing_period — race-safe upsert.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_or_create_billing_period(
          p_business_id UUID,
          p_year        INT DEFAULT EXTRACT(YEAR FROM NOW())::INT,
          p_month       INT DEFAULT EXTRACT(MONTH FROM NOW())::INT
      )
      RETURNS UUID LANGUAGE plpgsql AS $$
      DECLARE
          v_start DATE := make_date(p_year, p_month, 1);
          v_end   DATE := (make_date(p_year, p_month, 1) + INTERVAL '1 month - 1 day')::DATE;
          v_id    UUID;
      BEGIN
          INSERT INTO billing_periods (business_id, period_start, period_end)
          VALUES (p_business_id, v_start, v_end)
          ON CONFLICT (business_id, period_start) DO NOTHING;

          SELECT id INTO v_id FROM billing_periods
          WHERE business_id = p_business_id AND period_start = v_start;

          RETURN v_id;
      END;
      $$;
    `);

    // --- invoices -----------------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_invoices',
          },
          { name: 'billing_period_id', type: 'uuid', isNullable: false },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'amount', type: 'numeric', precision: 12, scale: 2, isNullable: false },
          { name: 'currency', type: 'char', length: '3', isNullable: false, default: `'USD'` },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'pending'`,
          },
          { name: 'processor_name', type: 'varchar', length: '50', isNullable: true },
          { name: 'processor_invoice_id', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'processor_payment_intent_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'processor_payment_url', type: 'text', isNullable: true },
          { name: 'due_date', type: 'date', isNullable: true },
          { name: 'paid_at', type: 'timestamptz', isNullable: true },
          ...auditColumns(),
        ],
        checks: [
          {
            name: 'ck_invoices_status',
            expression: `"status" IN ('pending','paid','overdue','cancelled','refunded')`,
          },
        ],
        uniques: [
          { name: 'uq_invoices_billing_period_id', columnNames: ['billing_period_id'] },
          { name: 'uq_invoices_processor_invoice_id', columnNames: ['processor_invoice_id'] },
        ],
        foreignKeys: [
          {
            name: 'fk_invoices_to_billing_periods',
            columnNames: ['billing_period_id'],
            referencedTableName: 'billing_periods',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_invoices_to_business_profiles',
            columnNames: ['business_id'],
            referencedTableName: 'business_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'idx_invoices_business_id',
        columnNames: ['business_id'],
      }),
    );
    await queryRunner.createIndex(
      'invoices',
      new TableIndex({
        name: 'idx_invoices_status',
        columnNames: ['status'],
      }),
    );

    // §C1 — deferred FK from Domain 7
    await queryRunner.query(`
      ALTER TABLE notifications
        ADD CONSTRAINT fk_notifications_to_invoices
        FOREIGN KEY (ref_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
    `);

    // --- invoice_line_items -------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'invoice_line_items',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_invoice_line_items',
          },
          { name: 'invoice_id', type: 'uuid', isNullable: false },
          { name: 'task_id', type: 'uuid', isNullable: false },
          { name: 'consultant_id', type: 'uuid', isNullable: false },
          { name: 'project_id', type: 'uuid', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'currency', type: 'char', length: '3', isNullable: false, default: `'USD'` },
          { name: 'amount', type: 'numeric', precision: 10, scale: 2, isNullable: false },
          {
            name: 'platform_fee_amount',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'consultant_payout',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_invoice_line_items_amount_split',
            expression: `"amount" = "platform_fee_amount" + "consultant_payout"`,
          },
        ],
        uniques: [
          {
            name: 'uq_invoice_line_items_invoice_task',
            columnNames: ['invoice_id', 'task_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_invoice_line_items_to_invoices',
            columnNames: ['invoice_id'],
            referencedTableName: 'invoices',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_invoice_line_items_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_invoice_line_items_to_consultant_profiles',
            columnNames: ['consultant_id'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_invoice_line_items_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_invoice" ON "invoice_line_items" ("invoice_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_consultant" ON "invoice_line_items" ("consultant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_invoice_line_items_task" ON "invoice_line_items" ("task_id")`,
    );

    // --- consultant_wallets -------------------------------------------------
    // §C2 — NO `>= 0` CHECK. Reversals can take cleared_balance negative.
    await queryRunner.createTable(
      new Table({
        name: 'consultant_wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_consultant_wallets',
          },
          { name: 'consultant_id', type: 'uuid', isNullable: false },
          {
            name: 'cleared_balance',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'pending_balance',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          { name: 'currency', type: 'char', length: '3', isNullable: false, default: `'USD'` },
          {
            name: 'total_earned',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'total_withdrawn',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          ...auditColumns(),
        ],
        uniques: [
          {
            name: 'uq_consultant_wallets_consultant_id',
            columnNames: ['consultant_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_consultant_wallets_to_consultant_profiles',
            columnNames: ['consultant_id'],
            referencedTableName: 'consultant_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // --- wallet_transactions ------------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'wallet_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_wallet_transactions',
          },
          { name: 'wallet_id', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '20', isNullable: false },
          { name: 'amount', type: 'numeric', precision: 10, scale: 2, isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'completed'`,
          },
          { name: 'invoice_id', type: 'uuid', isNullable: true },
          { name: 'task_id', type: 'uuid', isNullable: true },
          { name: 'project_id', type: 'uuid', isNullable: true },
          { name: 'withdrawal_method', type: 'varchar', length: '50', isNullable: true },
          { name: 'withdrawal_reference', type: 'varchar', length: '255', isNullable: true },
          { name: 'processor_event_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_wallet_transactions_type',
            expression: `"type" IN ('credit_pending','credit_cleared','debit_pending','withdrawal','reversal')`,
          },
          {
            name: 'ck_wallet_transactions_status',
            expression: `"status" IN ('completed','pending','failed','reversed')`,
          },
          {
            name: 'ck_wallet_transactions_amount',
            expression: `"amount" > 0`,
          },
        ],
        uniques: [
          {
            name: 'uq_wallet_transactions_processor_event_id',
            columnNames: ['processor_event_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_wallet_transactions_to_consultant_wallets',
            columnNames: ['wallet_id'],
            referencedTableName: 'consultant_wallets',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_wallet_transactions_to_invoices',
            columnNames: ['invoice_id'],
            referencedTableName: 'invoices',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_wallet_transactions_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_wallet_transactions_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_wallet_txn_wallet_created" ON "wallet_transactions" ("wallet_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wallet_txn_project" ON "wallet_transactions" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_wallet_txn_task" ON "wallet_transactions" ("task_id")`,
    );

    // §C8 — total_earned reversed when a reversal is recorded.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sync_wallet_balance_on_transaction()
      RETURNS TRIGGER AS $$
      BEGIN
          UPDATE consultant_wallets SET
              cleared_balance = cleared_balance + CASE NEW.type
                  WHEN 'credit_cleared'   THEN  NEW.amount
                  WHEN 'withdrawal'       THEN -NEW.amount
                  WHEN 'reversal'         THEN -NEW.amount
                  ELSE 0 END,
              pending_balance = pending_balance + CASE NEW.type
                  WHEN 'credit_pending'   THEN  NEW.amount
                  WHEN 'debit_pending'    THEN -NEW.amount
                  ELSE 0 END,
              total_earned = total_earned + CASE NEW.type
                  WHEN 'credit_cleared'   THEN  NEW.amount
                  WHEN 'reversal'         THEN -NEW.amount
                  ELSE 0 END,
              total_withdrawn = total_withdrawn + CASE
                  WHEN NEW.type = 'withdrawal' THEN NEW.amount ELSE 0 END,
              updated_at = NOW()
          WHERE id = NEW.wallet_id;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_sync_wallet_balance
        AFTER INSERT ON wallet_transactions
        FOR EACH ROW EXECUTE FUNCTION sync_wallet_balance_on_transaction();
    `);

    // Audit view — flags drift between stored balance and ledger sum.
    await queryRunner.query(`
      CREATE OR REPLACE VIEW v_wallet_balance_audit AS
      SELECT
          w.id              AS wallet_id,
          w.consultant_id,
          w.cleared_balance AS stored_cleared,
          w.pending_balance AS stored_pending,
          COALESCE(SUM(CASE wt.type
              WHEN 'credit_cleared' THEN  wt.amount
              WHEN 'withdrawal'     THEN -wt.amount
              WHEN 'reversal'       THEN -wt.amount
              ELSE 0 END), 0) AS computed_cleared,
          COALESCE(SUM(CASE wt.type
              WHEN 'credit_pending' THEN  wt.amount
              WHEN 'debit_pending'  THEN -wt.amount
              ELSE 0 END), 0) AS computed_pending,
          w.cleared_balance - COALESCE(SUM(CASE wt.type
              WHEN 'credit_cleared' THEN  wt.amount
              WHEN 'withdrawal'     THEN -wt.amount
              WHEN 'reversal'       THEN -wt.amount
              ELSE 0 END), 0) AS cleared_drift,
          w.pending_balance - COALESCE(SUM(CASE wt.type
              WHEN 'credit_pending' THEN  wt.amount
              WHEN 'debit_pending'  THEN -wt.amount
              ELSE 0 END), 0) AS pending_drift
      FROM consultant_wallets w
      LEFT JOIN wallet_transactions wt
        ON wt.wallet_id = w.id AND wt.status = 'completed'
      GROUP BY w.id, w.consultant_id, w.cleared_balance, w.pending_balance
    `);

    // --- business_transactions ----------------------------------------------
    await queryRunner.createTable(
      new Table({
        name: 'business_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_business_transactions',
          },
          { name: 'business_id', type: 'uuid', isNullable: false },
          { name: 'type', type: 'varchar', length: '25', isNullable: false },
          { name: 'amount', type: 'numeric', precision: 12, scale: 2, isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'completed'`,
          },
          { name: 'invoice_id', type: 'uuid', isNullable: true },
          { name: 'task_id', type: 'uuid', isNullable: true },
          { name: 'project_id', type: 'uuid', isNullable: true },
          { name: 'processor_event_id', type: 'varchar', length: '255', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
          ...traceColumns(),
        ],
        checks: [
          {
            name: 'ck_business_transactions_type',
            expression: `"type" IN ('invoice_created','payment_received','refund_issued','dispute_opened','dispute_resolved')`,
          },
          {
            name: 'ck_business_transactions_status',
            expression: `"status" IN ('completed','pending','failed','reversed')`,
          },
        ],
        uniques: [
          {
            name: 'uq_business_transactions_processor_event_id',
            columnNames: ['processor_event_id'],
          },
        ],
        foreignKeys: [
          {
            name: 'fk_business_transactions_to_business_profiles',
            columnNames: ['business_id'],
            referencedTableName: 'business_profiles',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            name: 'fk_business_transactions_to_invoices',
            columnNames: ['invoice_id'],
            referencedTableName: 'invoices',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_business_transactions_to_tasks',
            columnNames: ['task_id'],
            referencedTableName: 'tasks',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            name: 'fk_business_transactions_to_projects',
            columnNames: ['project_id'],
            referencedTableName: 'projects',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_business_txn_business" ON "business_transactions" ("business_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_business_txn_project" ON "business_transactions" ("project_id")`,
    );

    // --- webhook_events -----------------------------------------------------
    // §C4 — UNIQUE on (processor, event_id), not event_id alone.
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            primaryKeyConstraintName: 'pk_webhook_events',
          },
          { name: 'processor', type: 'varchar', length: '50', isNullable: false },
          { name: 'event_id', type: 'varchar', length: '255', isNullable: false },
          { name: 'event_type', type: 'varchar', length: '100', isNullable: false },
          { name: 'payload', type: 'jsonb', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'pending'`,
          },
          { name: 'retry_count', type: 'smallint', isNullable: false, default: 0 },
          { name: 'next_retry_at', type: 'timestamptz', isNullable: true },
          { name: 'last_error', type: 'text', isNullable: true },
          { name: 'processed_at', type: 'timestamptz', isNullable: true },
          { name: 'received_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
        ],
        checks: [
          {
            name: 'ck_webhook_events_status',
            expression: `"status" IN ('pending','processing','processed','failed','skipped')`,
          },
        ],
        uniques: [
          {
            name: 'uq_webhook_events_processor_event_id',
            columnNames: ['processor', 'event_id'],
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_webhook_events_retry" ON "webhook_events" ("next_retry_at") WHERE "status" IN ('pending','failed')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_events', true);
    await queryRunner.dropTable('business_transactions', true);
    await queryRunner.query(`DROP VIEW IF EXISTS v_wallet_balance_audit`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON wallet_transactions`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS sync_wallet_balance_on_transaction()`);
    await queryRunner.dropTable('wallet_transactions', true);
    await queryRunner.dropTable('consultant_wallets', true);
    await queryRunner.query(
      `ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_to_invoices`,
    );
    await queryRunner.dropTable('invoice_line_items', true);
    await queryRunner.dropTable('invoices', true);
    await queryRunner.query(
      `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_to_billing_periods`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_or_create_billing_period(UUID, INT, INT)`);
    await queryRunner.dropTable('billing_periods', true);
  }
}

function auditColumns(): {
  name: string;
  type: string;
  isNullable: boolean;
  default?: string;
}[] {
  return [
    { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
    { name: 'deleted_at', type: 'timestamptz', isNullable: true },
    { name: 'created_by', type: 'uuid', isNullable: true },
    { name: 'updated_by', type: 'uuid', isNullable: true },
    { name: 'deleted_by', type: 'uuid', isNullable: true },
  ];
}

function traceColumns(): {
  name: string;
  type: string;
  isNullable: boolean;
  default?: string;
}[] {
  return [
    { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'NOW()' },
    { name: 'created_by', type: 'uuid', isNullable: true },
  ];
}
