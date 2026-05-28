import { Metadata } from '@grpc/grpc-js';
import { ConsultantProfilesController } from '@modules/profiles/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from '@modules/profiles/consultant-profiles-admin.controller';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class ProfilesGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    consultantProfilesController: ConsultantProfilesController,
    consultantProfilesAdminController: ConsultantProfilesAdminController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'consultantProfiles',
        instance: consultantProfilesController,
        methods: {
          getProfile: (): Promise<unknown[]> => Promise.resolve([]),
          updateProfile: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
        },
      },
      {
        prefix: 'consultantProfilesAdmin',
        instance: consultantProfilesAdminController,
        methods: {
          list: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getById: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
        },
      },
    ]);
  }

  @GrpcMethod('Profiles', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
