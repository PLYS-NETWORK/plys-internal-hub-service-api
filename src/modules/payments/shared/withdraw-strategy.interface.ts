import { WithdrawResponseDto } from '../dto/responses/withdraw-response.dto';

/**
 * Strategy interface for platform-specific withdrawal logic.
 *
 * Why Strategy pattern: Business and Consultant use different entities
 * (`BusinessTransaction` vs `ConsultantTransaction`), different balance
 * fields, and different profile tables. A shared interface lets the
 * `PaymentsService` delegate without knowing the concrete platform.
 */
export interface IWithdrawStrategy {
  execute(amount: number, successUrl: string, cancelUrl: string): Promise<WithdrawResponseDto>;
}
