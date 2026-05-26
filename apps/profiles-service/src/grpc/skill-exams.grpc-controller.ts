import { Metadata } from '@grpc/grpc-js';
import { AdminConsultantSkillExamController } from '@modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller';
import { ConsultantSkillExamController } from '@modules/consultant-skill-exam/controllers/consultant-skill-exam.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class SkillExamsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    consultantSkillExamController: ConsultantSkillExamController,
    adminConsultantSkillExamController: AdminConsultantSkillExamController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'consultantSkillExam',
        instance: consultantSkillExamController,
        methods: {
          getCurrent: (): Promise<unknown[]> => Promise.resolve([]),
          getEligibility: (): Promise<unknown[]> => Promise.resolve([]),
          start: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getDetail: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'examId')]),
          submitAnswer: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'examId'), this.parseJsonBody(req)]),
          submit: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'examId')]),
        },
      },
      {
        prefix: 'adminConsultantSkillExam',
        instance: adminConsultantSkillExamController,
        methods: {
          list: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getDetail: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'examId')]),
        },
      },
    ]);
  }

  @GrpcMethod('SkillExams', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
