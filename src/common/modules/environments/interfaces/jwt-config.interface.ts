export interface IJwtConfig {
  readonly jwtAccessSecret: string;
  readonly jwtAccessExpiration: string;
  readonly jwtRefreshSecret: string;
  readonly jwtRefreshExpiration: string;
}
