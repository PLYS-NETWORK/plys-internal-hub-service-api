export interface IDataConnection {
  /** PostgreSQL server hostname or IP. */
  readonly dbHost: string;

  /** PostgreSQL server port (default 5432). */
  readonly dbPort: number;

  /** Database role used for all application queries. */
  readonly dbUsername: string;

  /** Password for `dbUsername`. Never logged. */
  readonly dbPassword: string;

  /** Name of the target PostgreSQL database. */
  readonly dbName: string;
}
