import { HealthResponseDto } from '../dto/responses/health-response.dto';

export interface IHealthService {
  /**
   * Probes database and Redis connectivity and returns their statuses.
   * @returns A HealthResponseDto whose `status` is `'ok'` only when all probes succeed.
   */
  check(): Promise<HealthResponseDto>;
}
