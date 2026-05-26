import { Metadata } from '@grpc/grpc-js';
import { BusinessOnboardingController } from '@modules/business-onboarding/controllers/business-onboarding.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class BusinessOnboardingGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    businessOnboardingController: BusinessOnboardingController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'businessOnboarding',
        instance: businessOnboardingController,
        methods: {
          submitProfile: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
        },
      },
    ]);
  }

  @GrpcMethod('BusinessOnboarding', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
