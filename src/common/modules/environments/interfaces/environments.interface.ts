import { IAppConfig } from './app-config.interface';
import { IDataConnection } from './data-connection.interface';
import { IJwtConfig } from './jwt-config.interface';
import { IPaymentConfig } from './payment-config.interface';
import { IResendConfig } from './resend-config.interface';

export interface IEnvironmentsService
  extends IAppConfig, IDataConnection, IJwtConfig, IResendConfig, IPaymentConfig {}
