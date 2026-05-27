import { Metadata } from '@grpc/grpc-js';
import { AiSyncController } from '@modules/business-projects/controllers/ai-sync.controller';
import { BacklogsController } from '@modules/business-projects/controllers/backlogs.controller';
import { BoardController } from '@modules/business-projects/controllers/board.controller';
import { BusinessProjectOverviewController } from '@modules/business-projects/controllers/overview.controller';
import { BusinessProjectsController } from '@modules/business-projects/controllers/projects.controller';
import { SettingsController } from '@modules/business-projects/controllers/settings.controller';
import { TaskAttachmentsController } from '@modules/business-projects/controllers/task-attachments.controller';
import { Controller, HttpStatus } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  buildSuccessResponse,
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  GrpcIdempotencyService,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class BusinessProjectsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    private readonly idempotency: GrpcIdempotencyService,
    businessProjectsController: BusinessProjectsController,
    overviewController: BusinessProjectOverviewController,
    boardController: BoardController,
    backlogsController: BacklogsController,
    settingsController: SettingsController,
    taskAttachmentsController: TaskAttachmentsController,
    aiSyncController: AiSyncController,
  ) {
    super(requestContext);
    this.handlers = {
      ...createControllerBridgeHandlers(this, [
        {
          prefix: 'businessProjects',
          instance: businessProjectsController,
          methods: {
            createProject: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
            listMyProjects: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
            searchMyProjects: (): Promise<unknown[]> => Promise.resolve([]),
            validatePublish: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id')]),
            republish: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
            transitionStatus: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
          },
        },
        {
          prefix: 'businessProjectOverview',
          instance: overviewController,
          methods: {
            getOverview: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id')]),
          },
        },
        {
          prefix: 'board',
          instance: boardController,
          methods: {
            listTasks: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            getMilestones: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            getTaskDetail: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.getPathParam(req, 'taskId')]),
            listHistory: (req): Promise<unknown[]> =>
              Promise.resolve([
                this.getPathParam(req, 'id'),
                this.getPathParam(req, 'taskId'),
                this.parseJsonBody(req),
              ]),
            listResults: (req): Promise<unknown[]> =>
              Promise.resolve([
                this.getPathParam(req, 'id'),
                this.getPathParam(req, 'taskId'),
                this.parseJsonBody(req),
              ]),
          },
        },
        {
          prefix: 'backlogs',
          instance: backlogsController,
          methods: {
            createDraftTask: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            listDraftTasks: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            getTaskDetail: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.getPathParam(req, 'taskId')]),
            updateDraftTask: (req): Promise<unknown[]> =>
              Promise.resolve([
                this.getPathParam(req, 'id'),
                this.getPathParam(req, 'taskId'),
                this.parseJsonBody(req),
              ]),
            addToBoard: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            payTasks: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
          },
        },
        {
          prefix: 'settings',
          instance: settingsController,
          methods: {
            getSettings: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id')]),
            updateProject: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
          },
        },
        {
          prefix: 'taskAttachments',
          instance: taskAttachmentsController,
          methods: {
            attach: (req): Promise<unknown[]> =>
              Promise.resolve([
                this.getPathParam(req, 'id'),
                this.getPathParam(req, 'taskId'),
                this.parseJsonBody(req),
              ]),
            update: (req): Promise<unknown[]> =>
              Promise.resolve([
                this.getPathParam(req, 'id'),
                this.getPathParam(req, 'taskId'),
                this.getPathParam(req, 'attachmentId'),
                this.parseJsonBody(req),
              ]),
          },
        },
        {
          prefix: 'aiSync',
          instance: aiSyncController,
          methods: {
            aiSyncSettings: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            aiSyncSkills: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            aiSyncTasks: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
          },
        },
      ]),
      'businessProjects.confirmPublish': async (request): Promise<IHttpResponse> => {
        await businessProjectsController.confirmPublish(this.getPathParam(request, 'id'));
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: null },
          HttpStatus.NO_CONTENT,
        );
      },
      'businessProjects.deleteProject': async (request): Promise<IHttpResponse> => {
        await businessProjectsController.deleteProject(this.getPathParam(request, 'id'));
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: null },
          HttpStatus.NO_CONTENT,
        );
      },
      'backlogs.bulkDelete': async (request): Promise<IHttpResponse> => {
        await backlogsController.bulkDelete(
          this.getPathParam(request, 'id'),
          this.parseJsonBody(request),
        );
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: null },
          HttpStatus.NO_CONTENT,
        );
      },
      'taskAttachments.remove': async (request): Promise<IHttpResponse> => {
        await taskAttachmentsController.remove(
          this.getPathParam(request, 'id'),
          this.getPathParam(request, 'taskId'),
          this.getPathParam(request, 'attachmentId'),
        );
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: null },
          HttpStatus.NO_CONTENT,
        );
      },
    };
  }

  @GrpcMethod('BusinessProjects', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return this.idempotency.wrapDispatch(request, metadata, () =>
      super.dispatch(request, metadata),
    );
  }
}
