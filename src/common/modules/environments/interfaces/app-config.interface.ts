export interface IAppConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly isProduction: boolean;
  readonly allowedOrigins: string[];
}
