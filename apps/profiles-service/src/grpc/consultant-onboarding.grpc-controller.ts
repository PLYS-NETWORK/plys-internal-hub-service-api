import { Metadata } from '@grpc/grpc-js';
import { ConsultantOnboardingController } from '@modules/consultant-onboarding/controllers/consultant-onboarding.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class ConsultantOnboardingGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    consultantOnboardingController: ConsultantOnboardingController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'consultantOnboarding',
        instance: consultantOnboardingController,
        methods: {
          getStatus: (): Promise<unknown[]> => Promise.resolve([]),
          submitProfile: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getQuestions: (): Promise<unknown[]> => Promise.resolve([]),
          submitInterview: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
        },
      },
    ]);
  }

  @GrpcMethod('ConsultantOnboarding', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
