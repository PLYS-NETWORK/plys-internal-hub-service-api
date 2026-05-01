import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import {
  BusinessTransactionType,
  ConsultantTransactionType,
  shortTypeFor,
  TransactionLedger,
} from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

/**
 * Generates the human-facing `transaction_number` for both ledgers using a
 * Postgres transaction-scoped advisory lock keyed on `(ledger, day)`. The
 * lock guarantees that the COUNT(*) → format → INSERT sequence is atomic
 * across concurrent transactions: any second caller waiting on the same
 * (ledger, day) pair sees the freshly-inserted row's count when its own
 * COUNT(*) runs after the first commits.
 *
 * Why advisory lock instead of a counter table:
 *   - `pg_advisory_xact_lock` releases automatically on commit/rollback —
 *     no orphan counter rows after a rollback.
 *   - The counter never drifts from real row count.
 *
 * Reentrancy: the lock is reentrant on the same xact, so two sequential
 * `next()` calls inside one `withTransaction` callback do not deadlock —
 * Postgres serialises them and each subsequent COUNT(*) sees the prior
 * insert's row.
 *
 * Use through `UnitOfWorkService.transactionNumbers` outside a transaction,
 * or through `txUow.transactionNumbers` inside `withTransaction(...)`. The
 * transactional binding clones via `withManager(manager)` so the advisory
 * lock and the COUNT both run on the same connection.
 */
@Injectable()
export class TransactionNumberService {
  constructor(
    private readonly requestContext: RequestContextService,
    @InjectEntityManager()
    private readonly manager: EntityManager,
  ) {}

  public withManager(manager: EntityManager): TransactionNumberService {
    return new TransactionNumberService(this.requestContext, manager);
  }

  /**
   * Computes the next transaction number for the given ledger + type. When
   * called outside a transaction, the advisory lock is taken on a one-shot
   * connection and released as soon as `next()` returns; that's safe but
   * any caller mutating the ledger is expected to be inside `withTransaction`
   * already, so in practice every call comes through `txUow`.
   */
  public async next(
    ledger: TransactionLedger,
    type: BusinessTransactionType | ConsultantTransactionType,
  ): Promise<string> {
    const tz = this.requestContext.timezone ?? undefined;
    const day = DateUtil.format(DateUtil.now(tz), 'YYYYMMDD', tz);
    const table = ledger === 'PLS' ? 'business_transactions' : 'consultant_transactions';

    // Acquire the day-scoped advisory lock. Two-int variant avoids 32-bit
    // hash collisions vs the single-bigint form. Released automatically when
    // the surrounding transaction commits or rolls back.
    await this.manager.query(
      `SELECT pg_advisory_xact_lock(hashtext($1)::int8, hashtext($2)::int8)`,
      [ledger, day],
    );

    // Count existing rows for this (ledger, day) prefix. Sargable against
    // `uq_<ledger>_transactions_number` because the prefix is fixed-width.
    const rows = (await this.manager.query(
      `SELECT COUNT(*)::int + 1 AS n FROM ${table} WHERE transaction_number LIKE $1`,
      [`${ledger}%${day}%`],
    )) as Array<{ n: number }>;
    const n = rows[0]?.n ?? 1;

    return `${ledger}${shortTypeFor(type)}${day}${n}`;
  }
}
