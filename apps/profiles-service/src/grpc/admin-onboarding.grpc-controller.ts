import { Metadata } from '@grpc/grpc-js';
import { AdminConsultantOnboardingController } from '@modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller';
import { AdminOnboardingQuestionsController } from '@modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class AdminOnboardingGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    adminConsultantOnboardingController: AdminConsultantOnboardingController,
    adminOnboardingQuestionsController: AdminOnboardingQuestionsController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'adminConsultantOnboarding',
        instance: adminConsultantOnboardingController,
        methods: {
          list: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getDetail: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
          decide: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
        },
      },
      {
        prefix: 'adminOnboardingQuestions',
        instance: adminOnboardingQuestionsController,
        methods: {
          create: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          listActive: (): Promise<unknown[]> => Promise.resolve([]),
          listInactive: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getById: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
          update: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
          setActive: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
          softDelete: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
          reorder: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
        },
      },
    ]);
  }

  @GrpcMethod('AdminOnboarding', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
