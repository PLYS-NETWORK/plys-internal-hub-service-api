/**
 * Minimal database env surface for TypeORM bootstrap (avoids common-nest cycle).
 */
export interface IDatabaseEnv {
  readonly dbHost: string;
  readonly dbPort: number;
  readonly dbUsername: string;
  readonly dbPassword: string;
  readonly dbName: string;
  readonly isLocal: boolean;
}
