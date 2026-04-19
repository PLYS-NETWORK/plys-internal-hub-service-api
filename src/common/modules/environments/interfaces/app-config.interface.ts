export interface IAppConfig {
  /** TCP port the HTTP server listens on. */
  readonly port: number;

  /** Current runtime environment (`development`, `production`, `test`). */
  readonly nodeEnv: string;

  /** `true` when `nodeEnv === 'production'`. Used to toggle safe defaults (sync off, TLS on, etc.). */
  readonly isProduction: boolean;

  /** List of origins allowed by the CORS policy. Supports wildcard `['*']` for local dev. */
  readonly allowedOrigins: string[];
}
