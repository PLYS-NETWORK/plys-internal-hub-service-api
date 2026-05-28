export type HealthStatus = 'ok' | 'error';

export interface IHealthResponse {
  readonly status: HealthStatus;
  readonly database: HealthStatus;
  readonly redis: HealthStatus;
}
