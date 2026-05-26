import { IAiKeysConfig } from './ai-keys-config.interface';
import { IAppConfig } from './app-config.interface';
import { IAwsS3Config } from './aws-s3-config.interface';
import { ICopyleaksConfig } from './copyleaks-config.interface';
import { IDataConnection } from './data-connection.interface';
import { IFilesConfig } from './files-config.interface';
import { IGoogleConfig } from './google-config.interface';
import { IIdentityConfig } from './identity-config.interface';
import { IJwtConfig } from './jwt-config.interface';
import { IPaymentConfig } from './payment-config.interface';
import { IRedisConfig } from './redis-config.interface';
import { IResendConfig } from './resend-config.interface';
import { ISecurityConfig } from './security-config.interface';

export interface IEnvironmentsService
  extends
    IAiKeysConfig,
    IAppConfig,
    IAwsS3Config,
    ICopyleaksConfig,
    IDataConnection,
    IFilesConfig,
    IJwtConfig,
    IResendConfig,
    IPaymentConfig,
    IGoogleConfig,
    IIdentityConfig,
    IRedisConfig,
    ISecurityConfig {}
