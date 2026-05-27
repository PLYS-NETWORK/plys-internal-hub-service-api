import { Metadata } from '@grpc/grpc-js';
import { Controller, HttpStatus } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AiProviderKeyAdminController } from '@plys/libraries/ai-provider-key';
import { AiProviderKeyBffController } from '@plys/libraries/ai-provider-key';
import {
  buildSuccessResponse,
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class AiProviderKeysGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    aiProviderKeyAdminController: AiProviderKeyAdminController,
    aiProviderKeyBffController: AiProviderKeyBffController,
  ) {
    super(requestContext);
    this.handlers = {
      ...createControllerBridgeHandlers(this, [
        {
          prefix: 'aiProviderKeyAdmin',
          instance: aiProviderKeyAdminController,
          methods: {
            list: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
            create: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
            update: (req): Promise<unknown[]> =>
              Promise.resolve([this.getPathParam(req, 'id'), this.parseJsonBody(req)]),
            activate: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
            reEncrypt: (): Promise<unknown[]> => Promise.resolve([]),
          },
        },
        {
          prefix: 'aiProviderKeyBff',
          instance: aiProviderKeyBffController,
          methods: {
            getActive: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          },
        },
      ]),
      'aiProviderKeyAdmin.revoke': async (request): Promise<IHttpResponse> => {
        await aiProviderKeyAdminController.revoke(this.getPathParam(request, 'id'));
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: null },
          HttpStatus.NO_CONTENT,
        );
      },
    };
  }

  @GrpcMethod('AiProviderKeys', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
