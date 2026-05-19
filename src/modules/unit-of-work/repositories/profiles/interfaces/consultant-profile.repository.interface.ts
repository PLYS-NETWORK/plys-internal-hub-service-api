import { AbstractRepository } from '@common/repositories';
import { ConsultantProfile } from '@database/entities';

export interface IConsultantProfileRepository extends AbstractRepository<ConsultantProfile> {
  findByUserId(userId: string): Promise<ConsultantProfile | null>;
  /**
   * Returns the userIds of all consultant profiles that have at least one skill
   * matching the provided skill IDs. Used for project skill-match fan-out.
   * @param skillIds Array of skill UUIDs to match against.
   * @param offset Pagination offset (for batched processing).
   * @param limit  Batch size.
   * @returns Array of userId strings.
   */
  findUserIdsBySkillIds(skillIds: string[], offset: number, limit: number): Promise<string[]>;

  /**
   * Sums `account_balance` across every consultant profile. Used by the admin
   * dashboard's `outstanding_payouts` KPI (total earnings sitting in wallets
   * awaiting withdrawal).
   * @returns Decimal string (`'0.00'` when no rows).
   */
  sumAccountBalances(): Promise<string>;

  /**
   * Atomically increments `account_balance` by `amount` (decimal string in
   * minor-unit-friendly form, e.g. `'25.00'`). Implemented as a single SQL
   * `UPDATE … SET account_balance = account_balance + :amount` so concurrent
   * earnings from different tasks cannot lose writes. Caller MUST be inside a
   * transaction together with the matching ledger row insert.
   *
   * @param consultantId Target consultant profile id (NOT user id).
   * @param amount       Positive decimal string; negative values are rejected.
   * @throws Error if the consultant profile is missing or `amount <= 0`.
   */
  incrementAccountBalance(consultantId: string, amount: string): Promise<void>;
}
