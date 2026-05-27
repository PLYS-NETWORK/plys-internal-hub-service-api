import { Metadata } from '@grpc/grpc-js';
import { BusinessProfilesController } from '@modules/profiles/business/business-profiles.controller';
import { BusinessProfilesAdminController } from '@modules/profiles/business/business-profiles-admin.controller';
import { ConsultantProfilesController } from '@modules/profiles/consultant/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from '@modules/profiles/consultant/consultant-profiles-admin.controller';
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
    businessProfilesController: BusinessProfilesController,
    businessProfilesAdminController: BusinessProfilesAdminController,
    consultantProfilesController: ConsultantProfilesController,
    consultantProfilesAdminController: ConsultantProfilesAdminController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'businessProfiles',
        instance: businessProfilesController,
        methods: {
          getProfile: (): Promise<unknown[]> => Promise.resolve([]),
          updateProfile: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
        },
      },
      {
        prefix: 'businessProfilesAdmin',
        instance: businessProfilesAdminController,
        methods: {
          list: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getById: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
          setPartnerPlatform: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
          setAllowPaymentCredit: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
        },
      },
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
