import { Metadata } from '@grpc/grpc-js';
import { ConsultantExploreController } from '@modules/consultant-projects/controllers/consultant-explore.controller';
import { ConsultantJoinedProjectsController } from '@modules/consultant-projects/controllers/consultant-joined-projects.controller';
import { ConsultantMembershipController } from '@modules/consultant-projects/controllers/consultant-membership.controller';
import { ConsultantProjectTasksController } from '@modules/consultant-projects/controllers/consultant-project-tasks.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class ConsultantProjectsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    consultantJoinedProjectsController: ConsultantJoinedProjectsController,
    consultantExploreController: ConsultantExploreController,
    consultantMembershipController: ConsultantMembershipController,
    consultantProjectTasksController: ConsultantProjectTasksController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'consultantJoinedProjects',
        instance: consultantJoinedProjectsController,
        methods: {
          listWorkspaces: (): Promise<unknown[]> => Promise.resolve([]),
          listJoinedProjects: (req): Promise<unknown[]> =>
            Promise.resolve([this.parseJsonBody(req)]),
          getJoinedProjectDetail: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId')]),
        },
      },
      {
        prefix: 'consultantExplore',
        instance: consultantExploreController,
        methods: {
          list: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getDetail: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
        },
      },
      {
        prefix: 'consultantMembership',
        instance: consultantMembershipController,
        methods: {
          apply: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId')]),
          leave: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId')]),
        },
      },
      {
        prefix: 'consultantProjectTasks',
        instance: consultantProjectTasksController,
        methods: {
          listTasks: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId'), this.parseJsonBody(req)]),
          assignTask: (req): Promise<unknown[]> =>
            Promise.resolve([
              this.getPathParam(req, 'projectId'),
              this.getPathParam(req, 'taskId'),
              this.parseJsonBody(req),
            ]),
          unassignTask: (req): Promise<unknown[]> =>
            Promise.resolve([
              this.getPathParam(req, 'projectId'),
              this.getPathParam(req, 'taskId'),
            ]),
          submitForReview: (req): Promise<unknown[]> =>
            Promise.resolve([
              this.getPathParam(req, 'projectId'),
              this.getPathParam(req, 'taskId'),
            ]),
        },
      },
    ]);
  }

  @GrpcMethod('ConsultantProjects', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
