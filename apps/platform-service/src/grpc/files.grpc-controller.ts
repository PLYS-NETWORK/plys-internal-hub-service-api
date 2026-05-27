import { Metadata } from '@grpc/grpc-js';
import { FilesController } from '@modules/files/files.controller';
import { FilesService } from '@modules/files/files.service';
import { Controller, HttpStatus } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  buildRedirectResponse,
  buildSuccessResponse,
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { IUploadInput } from '@plys/libraries/common-nest/modules/file-storage';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { FilePurpose } from '@plys/libraries/database/enums';
import { Readable } from 'stream';

interface IUploadRequestBody {
  buffer?: Buffer;
  bufferBase64?: string;
  mimeType: string;
  originalName: string;
  size: number;
  extension: string;
  purpose?: string;
}

@Controller()
export class FilesGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    filesController: FilesController,
    private readonly filesService: FilesService,
  ) {
    super(requestContext);
    this.handlers = {
      ...createControllerBridgeHandlers(this, [
        {
          prefix: 'files',
          instance: filesController,
          methods: {
            getById: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
          },
        },
      ]),
      'files.upload': async (request): Promise<IHttpResponse> => {
        const body = this.parseJsonBody<IUploadRequestBody>(request);
        const purpose = this.getQueryParam(request, 'purpose') ?? body.purpose;
        const acceptedPurpose =
          purpose === FilePurpose.CONSULTANT_CV || purpose === FilePurpose.AVATAR
            ? purpose
            : undefined;
        const input: IUploadInput = {
          buffer: body.bufferBase64
            ? Buffer.from(body.bufferBase64, 'base64')
            : (body.buffer ?? Buffer.alloc(0)),
          mimeType: body.mimeType,
          originalName: body.originalName,
          size: body.size,
          extension: body.extension,
        };
        const data = await this.filesService.upload(input, acceptedPurpose);
        return buildSuccessResponse({ messageKey: 'success.created', data }, HttpStatus.CREATED);
      },
      'files.download': async (request): Promise<IHttpResponse> => {
        const result = await this.filesService.download(this.getPathParam(request, 'id'));
        if (result.handle.kind === 'redirect') {
          return buildRedirectResponse(result.handle.url);
        }
        const body = await this.readStreamToBuffer(result.handle.stream);
        return {
          statusCode: HttpStatus.OK,
          body,
          errorCode: '',
          messageKey: 'success.ok',
          headers: {
            'content-type': result.mimeType,
            'content-length': String(result.sizeBytes),
          },
          cookies: {},
        };
      },
      'files.remove': async (request): Promise<IHttpResponse> => {
        await this.filesService.remove(this.getPathParam(request, 'id'));
        return buildSuccessResponse(
          { messageKey: 'success.ok', data: null },
          HttpStatus.NO_CONTENT,
        );
      },
    };
  }

  @GrpcMethod('Files', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }

  private async readStreamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
