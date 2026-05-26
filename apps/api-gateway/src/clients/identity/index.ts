export { IdentityClientsModule } from './identity-clients.module';
export {
  IDENTITY_GRPC,
  IdentityAdminAllowedEmailsClient,
  IdentityAdminAuthClient,
  IdentityAuthClient,
  IdentityUsersClient,
} from './identity-grpc.clients';
export {
  IdentitySessionClient,
  type IValidatedSession,
} from '@plys/libraries/common-nest/modules/identity-client';
